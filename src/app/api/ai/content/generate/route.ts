import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AiService } from '@/services/ai/AiService';
import { AiRequest } from '@/services/ai/providers/IAiProvider';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schema for content generation
const contentGenerationSchema = z.object({
  topic: z.string().min(3).max(200),
  contentType: z.enum(['article', 'exercise', 'video', 'audio', 'assessment', 'resource']),
  targetAudience: z.array(z.enum(['general', 'professionals', 'patients', 'caregivers'])).min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  category: z.array(z.string()).min(1).max(5),
  keyPoints: z.array(z.string()).optional(),
  tone: z.enum(['supportive', 'educational', 'encouraging', 'clinical']).default('supportive'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
});

// Mental health content generation prompts
const getContentPrompt = (params: z.infer<typeof contentGenerationSchema>) => {
  const { topic, contentType, targetAudience, difficulty, category, keyPoints, tone, length } = params;

  const audienceText = targetAudience.join(', ');
  const categoryText = category.join(', ');
  const difficultyText = difficulty ? ` at a ${difficulty} level` : '';
  const keyPointsText = keyPoints && keyPoints.length > 0 ? `\n\nKey points to cover:\n${keyPoints.map(point => `- ${point}`).join('\n')}` : '';

  const lengthGuidelines = {
    short: '300-500 words',
    medium: '600-1000 words',
    long: '1200-1800 words'
  };

  const basePrompt = `You are a mental health content creation assistant. Generate high-quality, evidence-based content for mental health support.

TOPIC: ${topic}
CONTENT TYPE: ${contentType}
TARGET AUDIENCE: ${audienceText}
CATEGORY: ${categoryText}
DIFFICULTY: ${difficulty || 'intermediate'}
TONE: ${tone}
LENGTH: ${lengthGuidelines[length]}

IMPORTANT REQUIREMENTS:
1. Include evidence-based information and cite general research where appropriate
2. Use supportive, non-stigmatizing language
3. Include appropriate disclaimers about professional help
4. Focus on empowerment and practical strategies
5. Avoid medical advice - suggest consulting professionals
6. Include crisis resources when relevant
7. Ensure content is culturally sensitive and inclusive${keyPointsText}

CONTENT STRUCTURE:
- Start with an engaging introduction
- Provide clear, actionable information
- Include practical tips or exercises where appropriate
- End with encouragement and resources
- Always include the following disclaimer at the end:

---
*Disclaimer: This content is for informational purposes only and is not a substitute for professional mental health treatment. If you're experiencing a mental health crisis, please contact emergency services or a mental health professional immediately. Resources: National Suicide Prevention Lifeline (988), Crisis Text Line (text HOME to 741741).*

Generate the content now:`;

  return basePrompt;
};

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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = contentGenerationSchema.parse(body);

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

    // Generate content prompt
    const prompt = getContentPrompt(validatedData);

    // Prepare AI request with mental health focused parameters
    const aiRequest: AiRequest = {
      prompt,
      model: 'claude-3-5-sonnet-20241022', // Use Claude for better mental health content
      temperature: 0.7, // Balanced creativity and accuracy
      maxTokens: 4000, // Sufficient for content generation
      context: {
        messages: [{
          role: 'system',
          content: 'You are a mental health content creation assistant specializing in evidence-based, trauma-informed, culturally sensitive, and empowerment-focused content creation.',
          timestamp: new Date()
        }]
      }
    };

    logger.info({
      userId,
      topic: validatedData.topic,
      contentType: validatedData.contentType,
      targetAudience: validatedData.targetAudience
    }, 'Generating AI mental health content');

    // Generate content
    const response = await aiService.generateText(aiRequest);

    // Extract content and ensure disclaimer is included
    let generatedContent = response.text;

    // Check if disclaimer is already included, if not add it
    if (!generatedContent.includes('Disclaimer:')) {
      generatedContent += '\n\n---\n*Disclaimer: This content is for informational purposes only and is not a substitute for professional mental health treatment. If you\'re experiencing a mental health crisis, please contact emergency services or a mental health professional immediately. Resources: National Suicide Prevention Lifeline (988), Crisis Text Line (text HOME to 741741).*';
    }

    return NextResponse.json({
      success: true,
      data: {
        content: generatedContent,
        metadata: {
          topic: validatedData.topic,
          contentType: validatedData.contentType,
          targetAudience: validatedData.targetAudience,
          category: validatedData.category,
          difficulty: validatedData.difficulty,
          tone: validatedData.tone,
          generatedAt: new Date().toISOString(),
          disclaimerIncluded: true
        },
        usage: response.usage
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues,
      }, { status: 400 });
    }

    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'AI content generation failed');

    return NextResponse.json({
      error: 'Content generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}