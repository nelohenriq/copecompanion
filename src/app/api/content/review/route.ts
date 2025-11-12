import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// GET /api/content/review - Get review queue
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a reviewer (simplified - in production, check user roles)
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // TODO: Add role-based access control for reviewers
    // For now, allow any authenticated user to see reviews

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Build where clause
    const where: any = {};
    if (status !== 'all') where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo === 'me') {
      where.assignedTo = user.id;
    } else if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    const reviews = await (prisma as any).contentReview.findMany({
      where,
      include: {
        content: {
          include: {
            author: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // High priority first
        { submittedAt: 'asc' }, // Oldest first
      ],
      take: limit,
    });

    // Get statistics
    const stats = await getReviewStats();

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        stats,
        filters: {
          status,
          priority,
          assignedTo,
          limit,
        },
      },
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to fetch review queue');

    return NextResponse.json({
      error: 'Failed to fetch review queue',
    }, { status: 500 });
  }
}

// POST /api/content/review - Assign review or update status
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reviewId, notes } = body;

    if (!reviewId || !action) {
      return NextResponse.json({ error: 'Review ID and action are required' }, { status: 400 });
    }

    // Get the review
    const review = await (prisma as any).contentReview.findUnique({
      where: { id: reviewId },
      include: { content: true },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    let updateData: any = {};

    switch (action) {
      case 'assign':
        updateData = {
          assignedTo: user.id,
          assignedAt: new Date(),
          assignedBy: user.id,
          status: 'in_review',
        };
        break;

      case 'start_review':
        if (review.assignedTo !== user.id) {
          return NextResponse.json({ error: 'Review not assigned to you' }, { status: 403 });
        }
        updateData = {
          status: 'in_review',
        };
        break;

      case 'submit_review':
        if (review.assignedTo !== user.id) {
          return NextResponse.json({ error: 'Review not assigned to you' }, { status: 403 });
        }
        updateData = {
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewNotes: notes,
          status: 'reviewed',
        };
        break;

      case 'request_revision':
        if (review.assignedTo !== user.id) {
          return NextResponse.json({ error: 'Review not assigned to you' }, { status: 403 });
        }
        updateData = {
          revisionRequested: true,
          revisionNotes: notes,
          status: 'needs_revision',
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update the review
    const updatedReview = await (prisma as any).contentReview.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        content: {
          include: {
            author: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    // Log the action
    await (prisma as any).contentAccess.create({
      data: {
        contentId: review.contentId,
        userId: user.id,
        action: `review_${action}`,
      },
    }).catch(() => {}); // Ignore logging errors

    logger.info({
      reviewId,
      contentId: review.contentId,
      action,
      userId: user.id,
    }, 'Review action performed');

    return NextResponse.json({
      success: true,
      data: updatedReview,
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Review action failed');

    return NextResponse.json({
      error: 'Review action failed',
    }, { status: 500 });
  }
}

// Helper function to get review statistics
async function getReviewStats() {
  try {
    const [
      pendingCount,
      inReviewCount,
      approvedCount,
      rejectedCount,
      needsRevisionCount,
    ] = await Promise.all([
      (prisma as any).contentReview.count({ where: { status: 'pending' } }),
      (prisma as any).contentReview.count({ where: { status: 'in_review' } }),
      (prisma as any).contentReview.count({ where: { status: 'approved' } }),
      (prisma as any).contentReview.count({ where: { status: 'rejected' } }),
      (prisma as any).contentReview.count({ where: { status: 'needs_revision' } }),
    ]);

    return {
      pending: pendingCount,
      inReview: inReviewCount,
      approved: approvedCount,
      rejected: rejectedCount,
      needsRevision: needsRevisionCount,
      total: pendingCount + inReviewCount + approvedCount + rejectedCount + needsRevisionCount,
    };
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to get review stats');
    return {
      pending: 0,
      inReview: 0,
      approved: 0,
      rejected: 0,
      needsRevision: 0,
      total: 0,
    };
  }
}