import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AiService } from '@/services/ai/AiService';
import { AiRequest } from '@/services/ai/providers/IAiProvider';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Cache for AiService instances per user
const aiServiceCache = new Map<string, AiService>();

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Parse request body
    const body = await request.json();
    const { prompt, model, temperature, maxTokens, context } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Get or create AiService for user
    let aiService = aiServiceCache.get(userId);
    if (!aiService) {
      aiService = new AiService({
        userId,
        cacheEnabled: true,
        cacheTtl: 3600, // 1 hour
      });
      await aiService.initialize();
      aiServiceCache.set(userId, aiService);
    }

    // Prepare AI request
    const aiRequest: AiRequest = {
      prompt,
      model,
      temperature,
      maxTokens,
      context,
    };

    logger.info({
      userId,
      model,
      promptLength: prompt.length
    }, 'Processing AI generation request');

    // Generate response
    const response = await aiService.generateText(aiRequest);

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'AI generation failed');

    return NextResponse.json({
      error: 'AI generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Streaming endpoint
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get('prompt');
    const model = searchParams.get('model');

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Get or create AiService for user
    let aiService = aiServiceCache.get(userId);
    if (!aiService) {
      aiService = new AiService({
        userId,
        cacheEnabled: true,
        cacheTtl: 3600,
      });
      await aiService.initialize();
      aiServiceCache.set(userId, aiService);
    }

    const aiRequest: AiRequest = {
      prompt,
      model: model || undefined,
    };

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiService.generateStream(aiRequest)) {
            const data = JSON.stringify(chunk) + '\n';
            controller.enqueue(new TextEncoder().encode(data));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'AI streaming failed');

    return NextResponse.json({
      error: 'AI streaming failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}