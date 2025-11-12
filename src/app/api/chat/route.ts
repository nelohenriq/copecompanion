import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AiService } from '@/services/ai/AiService';
import { ConversationContext } from '@/services/ai/providers/IAiProvider';
import { CrisisDetectionService, CrisisDetectionConfig } from '@/services/crisis-detection/CrisisDetectionService';
import { PersonalizationService } from '@/services/personalization/PersonalizationService';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// Cache for AiService instances per user
const aiServiceCache = new Map<string, AiService>();

// Crisis detection service (shared instance)
const crisisDetectionConfig: CrisisDetectionConfig = {
  enabled: true,
  riskThresholds: { low: 2, medium: 4, high: 6 },
  analysisFrequency: 'realtime',
  aiModel: 'gpt-4', // Use GPT-4 for crisis analysis
  alertChannels: ['email', 'inapp'],
};

let crisisDetectionService: CrisisDetectionService;
let personalizationService: PersonalizationService;

// Simple rate limiting (in production, use Redis or similar)
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50; // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

interface ChatRequest {
  message: string;
  conversationId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body: ChatRequest = await request.json();
    const { message, conversationId, model, temperature, maxTokens } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Sanitize and validate input
    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage) {
      return NextResponse.json({ error: 'Invalid message content' }, { status: 400 });
    }

    // Get or create conversation
    let conversation = await getOrCreateConversation(userId, conversationId);

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

      // Initialize crisis detection service if not already done
      if (!crisisDetectionService) {
        crisisDetectionService = new CrisisDetectionService(aiService, crisisDetectionConfig);
      }

      // Initialize personalization service if not already done
      if (!personalizationService) {
        personalizationService = new PersonalizationService(aiService);
      }
    }

    // Build conversation context
    const context: ConversationContext = {
      sessionId: conversation.id,
      messages: conversation.messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    };

    // Add user message to context
    context.messages.push({
      role: 'user',
      content: sanitizedMessage,
    });

    logger.info({
      userId,
      conversationId: conversation.id,
      messageLength: sanitizedMessage.length,
      model,
    }, 'Processing chat message');

    // Generate AI response
    const aiResponse = await aiService.generateText({
      prompt: sanitizedMessage,
      model,
      temperature,
      maxTokens,
      context,
    });

    // Check for crisis indicators using advanced detection service
    const crisisAssessment = await crisisDetectionService.analyzeMessage(
      sanitizedMessage,
      conversation.id,
      userId,
      conversation.messages.map((msg: any) => msg.content)
    );

    let crisisDetected = null;
    if (crisisAssessment) {
      crisisDetected = {
        level: crisisAssessment.riskLevel,
        flagged: true,
      };

      // Modify response for high-risk situations
      if (crisisAssessment.riskLevel === 'high') {
        aiResponse.text = "I'm here to support you. If you're experiencing a crisis, please reach out to a mental health professional or call emergency services immediately. " + aiResponse.text;
      } else if (crisisAssessment.riskLevel === 'medium') {
        aiResponse.text = "I'm here to support you. If you're feeling distressed, consider reaching out to a mental health professional. " + aiResponse.text;
      }
    }

    // Apply personalization to the response
    const conversationContext = conversation.messages.map((msg: any) => msg.content);
    aiResponse.text = await personalizationService.personalizeResponse(
      aiResponse.text,
      userId,
      conversationContext
    );

    // Save messages to database
    await saveMessageToConversation(conversation.id, 'user', sanitizedMessage);
    await saveMessageToConversation(conversation.id, 'assistant', aiResponse.text);

    // Update conversation last activity
    await (prisma as any).conversation.update({
      where: { id: conversation.id },
      data: { lastActivity: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: aiResponse.text,
        conversationId: conversation.id,
        usage: aiResponse.usage,
        metadata: aiResponse.metadata,
        crisisDetected: crisisDetected ? {
          level: crisisDetected.level,
          flagged: true,
        } : null,
      },
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Chat API error');

    return NextResponse.json({
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Helper functions

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = userRequestCounts.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize limit
    userRequestCounts.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

function sanitizeInput(input: string): string | null {
  // Basic sanitization - remove potentially harmful content
  const sanitized = input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .slice(0, 10000); // Limit length

  // Check for empty or invalid content
  if (!sanitized || sanitized.length === 0) {
    return null;
  }

  return sanitized;
}

async function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const conversation = await (prisma as any).conversation.findFirst({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    });

    if (conversation) {
      return conversation;
    }
  }

  // Create new conversation
  const conversation = await (prisma as any).conversation.create({
    data: {
      userId,
      title: 'New Conversation',
    },
    include: { messages: { orderBy: { timestamp: 'asc' } } },
  });

  logger.info({
    userId,
    conversationId: conversation.id,
  }, 'Created new conversation');

  return conversation;
}

async function saveMessageToConversation(conversationId: string, role: 'user' | 'assistant', content: string) {
  await (prisma as any).message.create({
    data: {
      conversationId,
      role,
      content,
    },
  });
}
