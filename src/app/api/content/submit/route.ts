import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for content submission
const submitContentSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  content: z.string().min(50).optional(),
  contentUrl: z.string().url().optional(),
  contentType: z.enum(['article', 'exercise', 'video', 'audio', 'assessment', 'resource']),
  category: z.array(z.string()).min(1).max(5),
  tags: z.array(z.string()).min(1).max(10),
  targetAudience: z.array(z.enum(['general', 'professionals', 'patients', 'caregivers'])).default(['general']),
  readingTime: z.number().min(1).max(120).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  language: z.string().default('en'),
  source: z.string().optional(), // Where the content came from
  references: z.array(z.string()).optional(), // Supporting references
  notes: z.string().max(500).optional(), // Submitter's notes for reviewers
});

// POST /api/content/submit - Submit content for review
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = submitContentSchema.parse(body);

    // Check if user can submit content (basic check - can be expanded)
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create content in draft status for review
    const content = await (prisma as any).content.create({
      data: {
        ...validatedData,
        status: 'pending_review',
        createdBy: user.id,
        updatedBy: user.id,
        // Add submission metadata
        submittedAt: new Date(),
        submittedBy: user.id,
        submissionNotes: validatedData.notes,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create review queue entry
    await (prisma as any).contentReview.create({
      data: {
        contentId: content.id,
        status: 'pending',
        priority: 'normal', // Can be determined by content type or user role
        submittedBy: user.id,
        submittedAt: new Date(),
        reviewNotes: validatedData.notes,
      },
    });

    // Log content submission
    await (prisma as any).contentAccess.create({
      data: {
        contentId: content.id,
        userId: user.id,
        action: 'submit',
      },
    }).catch(() => {}); // Ignore logging errors

    logger.info({
      contentId: content.id,
      userId: user.id,
      contentType: content.contentType,
    }, 'Content submitted for review');

    return NextResponse.json({
      success: true,
      data: {
        content,
        message: 'Content submitted successfully and is pending review',
        reviewStatus: 'pending',
      },
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues,
      }, { status: 400 });
    }

    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Content submission failed');

    return NextResponse.json({
      error: 'Content submission failed',
    }, { status: 500 });
  }
}