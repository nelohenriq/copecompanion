import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// Helper function to check permissions
async function checkContentPermissions(userId: string, action: 'read' | 'update' | 'delete' | 'publish', content: any) {
  // Get user role (simplified - in production, this would check user roles/permissions)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }, // In production, check roles/permissions
  });

  if (!user) return false;

  // Basic permission checks (expand based on your role system)
  switch (action) {
    case 'read':
      // Check access level
      if (content.accessLevel === 'public') return true;
      if (content.accessLevel === 'authenticated' && userId) return true;
      if (content.accessLevel === 'professional') {
        // TODO: Check if user has professional role
        return content.createdBy === userId; // For now, only creator can access professional content
      }
      return false;
    case 'update':
    case 'delete':
      return content.createdBy === userId; // Only creator can edit/delete
    case 'publish':
      return content.createdBy === userId; // Only creator can publish (in production, check roles)
    default:
      return false;
  }
}

// GET /api/content/[id] - Get specific content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    // Get content
    const content = await (prisma as any).content.findUnique({
      where: { id: contentId },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check read permissions
    if (!(await checkContentPermissions(user?.id, 'read', content))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Log access
    if (user?.id) {
      await (prisma as any).contentAccess.create({
        data: {
          contentId,
          userId: user.id,
          action: 'view',
        },
      }).catch(() => {}); // Ignore logging errors
    }

    return NextResponse.json({
      success: true,
      data: content,
    });

  } catch (error) {
    logger.error({
      contentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to fetch content');

    return NextResponse.json({
      error: 'Failed to fetch content',
    }, { status: 500 });
  }
}

// PUT /api/content/[id] - Update content
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing content
    const existingContent = await (prisma as any).content.findUnique({
      where: { id: contentId },
    });

    if (!existingContent) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check update permissions
    if (!(await checkContentPermissions(user.id, 'update', existingContent))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    // Basic validation
    if (body.title && (typeof body.title !== 'string' || body.title.length < 1 || body.title.length > 200)) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }

    // Handle status changes
    if (body.status && body.status !== existingContent.status) {
      if (body.status === 'published') {
        // Check publish permissions
        if (!(await checkContentPermissions(user.id, 'publish', existingContent))) {
          return NextResponse.json({ error: 'Cannot publish content' }, { status: 403 });
        }
        body.publishedAt = new Date();
      } else if (body.status === 'archived') {
        body.archivedAt = new Date();
      }
    }

    // Update content
    const updatedContent = await (prisma as any).content.update({
      where: { id: contentId },
      data: {
        ...body,
        updatedBy: user.id,
        version: { increment: 1 },
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log content update
    await (prisma as any).contentAccess.create({
      data: {
        contentId,
        userId: user.id,
        action: 'update',
      },
    }).catch(() => {}); // Ignore logging errors

    logger.info({
      contentId,
      userId: user.id,
      changes: Object.keys(body)
    }, 'Content updated');

    return NextResponse.json({
      success: true,
      data: updatedContent,
    });

  } catch (error) {
    logger.error({
      contentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to update content');

    return NextResponse.json({
      error: 'Failed to update content',
    }, { status: 500 });
  }
}

// DELETE /api/content/[id] - Delete content
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing content
    const existingContent = await (prisma as any).content.findUnique({
      where: { id: contentId },
    });

    if (!existingContent) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Check delete permissions
    if (!(await checkContentPermissions(user.id, 'delete', existingContent))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Soft delete by archiving (or hard delete if preferred)
    const deletedContent = await (prisma as any).content.update({
      where: { id: contentId },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        updatedBy: user.id,
      },
    });

    // Log content deletion
    await (prisma as any).contentAccess.create({
      data: {
        contentId,
        userId: user.id,
        action: 'delete',
      },
    }).catch(() => {}); // Ignore logging errors

    logger.info({
      contentId,
      userId: user.id
    }, 'Content archived (deleted)');

    return NextResponse.json({
      success: true,
      message: 'Content archived successfully',
      data: deletedContent,
    });

  } catch (error) {
    logger.error({
      contentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to delete content');

    return NextResponse.json({
      error: 'Failed to delete content',
    }, { status: 500 });
  }
}