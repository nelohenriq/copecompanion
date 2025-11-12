import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ContentQualityService } from '@/services/content/ContentQualityService';

// POST /api/content/validate/[id] - Validate content quality
export async function POST(
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

    // Initialize quality service
    const qualityService = new ContentQualityService();

    // Perform quality validation
    const validationResult = await qualityService.validateContent(contentId);

    // Log validation results
    logger.info({
      contentId,
      userId: user.id,
      overallScore: validationResult.overallScore,
      passed: validationResult.passed,
      checksCount: validationResult.checks.length,
    }, 'Content quality validation completed');

    return NextResponse.json({
      success: true,
      data: validationResult,
    });

  } catch (error) {
    logger.error({
      contentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Content quality validation failed');

    return NextResponse.json({
      error: 'Content quality validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}