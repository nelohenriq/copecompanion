import { NextRequest, NextResponse } from 'next/server';
import { EmotionDetectionService, EmotionContext } from '@/services/emotion/EmotionDetectionService';
import { EmotionalUXService } from '@/services/ux/EmotionalUXService';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schema for emotion detection request
const emotionDetectionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  sessionId: z.string().optional(),
  interactionType: z.enum(['chat', 'content_view', 'form_input', 'navigation', 'idle']).optional(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

const emotionService = new EmotionDetectionService();
const uxService = new EmotionalUXService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = emotionDetectionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { userId, sessionId, interactionType, content, metadata } = validationResult.data;

    // Create emotion context
    const context: EmotionContext = {
      userId,
      sessionId: sessionId || 'api-session',
      interactionType: interactionType || 'content_view',
      content,
      metadata: metadata || {}
    };

    // Detect emotion
    const emotion = await emotionService.detectEmotion(context);

    // Get UX adaptation
    const adaptation = await uxService.getEmotionalUXAdaptation(userId, context);

    // Generate CSS variables for the adaptation
    const cssVariables = uxService.generateCSSVariables(adaptation);

    logger.info({
      userId,
      emotion: emotion.primaryEmotion,
      intensity: emotion.intensity,
      confidence: emotion.confidence,
      interactionType: context.interactionType
    }, 'Emotion detected via API');

    return NextResponse.json({
      emotion,
      adaptation,
      cssVariables,
      detectedAt: emotion.detectedAt,
      processingTime: Date.now() - emotion.detectedAt.getTime()
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to detect emotion via API');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process emotion detection request'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get emotion history
    const history = emotionService.getEmotionHistory(userId, Math.min(limit, 50)); // Cap at 50

    // Get UX service health
    const health = await uxService.healthCheck();

    return NextResponse.json({
      history,
      health,
      totalHistoryItems: history.length
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to get emotion history via API');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve emotion history'
      },
      { status: 500 }
    );
  }
}