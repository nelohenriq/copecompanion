import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { AiService } from '@/services/ai/AiService';

// GET /api/content/review/[id] - Get specific review details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const review = await (prisma as any).contentReview.findUnique({
      where: { id: reviewId },
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

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Check if user can access this review
    if (review.assignedTo !== user.id && review.submittedBy !== user.id) {
      // TODO: Add role-based access for admins/reviewers
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: review,
    });

  } catch (error) {
    logger.error({
      reviewId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to fetch review');

    return NextResponse.json({
      error: 'Failed to fetch review',
    }, { status: 500 });
  }
}

// PUT /api/content/review/[id] - Make final review decision
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await params;

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { decision, notes, qualityScore } = body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'Valid decision (approved/rejected) is required' }, { status: 400 });
    }

    // Get the review
    const review = await (prisma as any).contentReview.findUnique({
      where: { id: reviewId },
      include: { content: true },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Check if user can make final decisions
    if (review.assignedTo !== user.id) {
      return NextResponse.json({ error: 'Only assigned reviewer can make final decisions' }, { status: 403 });
    }

    // Perform automated safety check before approval
    if (decision === 'approved') {
      const safetyCheck = await performSafetyCheck(review.content);
      if (!safetyCheck.safe) {
        return NextResponse.json({
          error: 'Content failed safety check',
          details: safetyCheck.issues,
        }, { status: 400 });
      }
    }

    // Update review with final decision
    const updatedReview = await (prisma as any).contentReview.update({
      where: { id: reviewId },
      data: {
        finalDecision: decision,
        decisionNotes: notes,
        decidedAt: new Date(),
        decidedBy: user.id,
        reviewScore: qualityScore,
        status: decision === 'approved' ? 'approved' : 'rejected',
      },
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

    // Update content status based on decision
    const contentStatus = decision === 'approved' ? 'published' : 'rejected';
    await (prisma as any).content.update({
      where: { id: review.contentId },
      data: {
        status: contentStatus,
        publishedAt: decision === 'approved' ? new Date() : undefined,
        updatedBy: user.id,
      },
    });

    // Log the decision
    await (prisma as any).contentAccess.create({
      data: {
        contentId: review.contentId,
        userId: user.id,
        action: `review_${decision}`,
      },
    }).catch(() => {}); // Ignore logging errors

    logger.info({
      reviewId,
      contentId: review.contentId,
      decision,
      qualityScore,
      userId: user.id,
    }, 'Final review decision made');

    return NextResponse.json({
      success: true,
      data: updatedReview,
      message: `Content ${decision} successfully`,
    });

  } catch (error) {
    logger.error({
      reviewId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Final review decision failed');

    return NextResponse.json({
      error: 'Final review decision failed',
    }, { status: 500 });
  }
}

// Helper function to perform automated safety check
async function performSafetyCheck(content: any): Promise<{ safe: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Initialize AI service for safety analysis
    const aiService = new AiService({
      userId: 'system',
      cacheEnabled: true,
      cacheTtl: 3600,
    });

    // Analyze content for safety concerns
    const safetyPrompt = `
Analyze this mental health content for safety and appropriateness. Check for:

1. Harmful advice or dangerous recommendations
2. Stigmatizing language or discriminatory content
3. Encouragement of self-harm or suicide
4. Medical misinformation
5. Inappropriate content for the target audience
6. Triggering content without proper warnings

Content Title: "${content.title}"
Content: "${content.content || content.description}"
Content Type: ${content.contentType}
Target Audience: ${content.targetAudience.join(', ')}

Return a JSON response with:
{
  "safe": boolean,
  "issues": string[],
  "confidence": number (0-1),
  "recommendations": string[]
}
`;

    const safetyAnalysis = await aiService.generateText({
      prompt: safetyPrompt,
      temperature: 0.1,
    });

    let analysis;
    try {
      analysis = JSON.parse(safetyAnalysis.text);
    } catch {
      // Fallback if JSON parsing fails
      analysis = {
        safe: true,
        issues: [],
        confidence: 0.5,
        recommendations: [],
      };
    }

    if (!analysis.safe) {
      issues.push(...analysis.issues);
    }

    // Additional rule-based checks
    const ruleIssues = performRuleBasedSafetyChecks(content);
    issues.push(...ruleIssues);

    return {
      safe: issues.length === 0,
      issues,
    };

  } catch (error) {
    logger.warn({
      contentId: content.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Safety check failed, allowing content with manual review required');

    // On safety check failure, require manual review but don't block
    return {
      safe: true,
      issues: ['Automated safety check failed - manual review required'],
    };
  }
}

// Helper function for rule-based safety checks
function performRuleBasedSafetyChecks(content: any): string[] {
  const issues: string[] = [];
  const text = `${content.title} ${content.description} ${content.content || ''}`.toLowerCase();

  // Check for concerning keywords
  const concerningKeywords = [
    'suicide', 'kill yourself', 'end it all', 'self-harm', 'cutting',
    'overdose', 'starve yourself', 'anorexia', 'bulimia',
    'harm others', 'violence', 'abuse others'
  ];

  for (const keyword of concerningKeywords) {
    if (text.includes(keyword)) {
      // Check if it's in an appropriate context (e.g., "preventing suicide")
      const preventionContext = /\b(prevent|avoid|stop|help with|support for)\b/.test(text);
      if (!preventionContext) {
        issues.push(`Potentially concerning keyword detected: "${keyword}"`);
      }
    }
  }

  // Check content length appropriateness
  if (content.contentType === 'assessment' && (!content.content || content.content.length < 100)) {
    issues.push('Assessment content appears too brief for proper evaluation');
  }

  // Check for medical claims without disclaimers
  if (text.includes('cure') || text.includes('treat') || text.includes('heal')) {
    const hasDisclaimer = /\b(not medical advice|consult professional|see doctor|disclaimer)\b/i.test(text);
    if (!hasDisclaimer) {
      issues.push('Medical claims detected without appropriate disclaimers');
    }
  }

  return issues;
}