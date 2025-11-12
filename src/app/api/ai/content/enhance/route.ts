import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AiService } from '@/services/ai/AiService';
import { AiRequest } from '@/services/ai/providers/IAiProvider';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schema for content enhancement
const contentEnhancementSchema = z.object({
  contentId: z.string().optional(),
  title: z.string().min(1),
  content: z.string().min(10),
  contentType: z.enum(['article', 'exercise', 'video', 'audio', 'assessment', 'resource']),
  targetAudience: z.array(z.enum(['general', 'professionals', 'patients', 'caregivers'])).min(1),
  category: z.array(z.string()).min(1),
  enhancementType: z.enum(['clarity', 'engagement', 'accessibility', 'comprehensiveness', 'safety', 'full_review'])
});

// Content enhancement prompts
const getEnhancementPrompt = (params: z.infer<typeof contentEnhancementSchema>) => {
  const { title, content, contentType, targetAudience, category, enhancementType } = params;

  const audienceText = targetAudience.join(', ');
  const categoryText = category.join(', ');

  const enhancementGuidelines = {
    clarity: `Focus on improving clarity, readability, and logical flow. Make complex concepts easier to understand while maintaining accuracy.`,
    engagement: `Enhance engagement by adding compelling hooks, practical examples, and interactive elements appropriate for the content type.`,
    accessibility: `Improve accessibility by simplifying language, adding clear structure, and ensuring inclusive communication.`,
    comprehensiveness: `Add depth and comprehensiveness by including additional relevant information, examples, and resources.`,
    safety: `Review for mental health safety, ensuring appropriate disclaimers, crisis resources, and trauma-informed language.`,
    full_review: `Provide comprehensive improvements across all areas: clarity, engagement, accessibility, comprehensiveness, and safety.`
  };

  const basePrompt = `You are a mental health content enhancement specialist. Analyze and improve the following content.

CONTENT TITLE: ${title}
CONTENT TYPE: ${contentType}
TARGET AUDIENCE: ${audienceText}
CATEGORY: ${categoryText}
ENHANCEMENT FOCUS: ${enhancementGuidelines[enhancementType]}

ORIGINAL CONTENT:
${content}

MENTAL HEALTH CONTENT STANDARDS:
- Evidence-based information
- Trauma-informed language
- Culturally sensitive approach
- Empowerment-focused messaging
- Clear crisis resources
- Professional consultation recommendations
- Non-stigmatizing terminology

Please provide:
1. **Analysis**: Brief assessment of current strengths and areas for improvement
2. **Enhanced Content**: Improved version incorporating your recommendations
3. **Specific Changes**: List of key changes made and rationale
4. **Quality Score**: Rate the enhanced content (1-10) with justification

Ensure the enhanced content maintains professional mental health standards and includes appropriate disclaimers.`;

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
    const validatedData = contentEnhancementSchema.parse(body);

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

    // Generate enhancement prompt
    const prompt = getEnhancementPrompt(validatedData);

    // Prepare AI request
    const aiRequest: AiRequest = {
      prompt,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3, // Lower temperature for more consistent analysis
      maxTokens: 6000, // Sufficient for detailed analysis and enhanced content
      context: {
        messages: [{
          role: 'system',
          content: 'You are an expert mental health content editor providing constructive, evidence-based feedback and improvements.',
          timestamp: new Date()
        }]
      }
    };

    logger.info({
      userId,
      contentId: validatedData.contentId,
      title: validatedData.title,
      enhancementType: validatedData.enhancementType
    }, 'Enhancing content with AI');

    // Generate enhancement
    const response = await aiService.generateText(aiRequest);

    // Parse the AI response to extract structured data
    const aiText = response.text;

    // Extract sections from the response (basic parsing)
    const analysis = extractSection(aiText, 'Analysis');
    const enhancedContent = extractSection(aiText, 'Enhanced Content');
    const changes = extractSection(aiText, 'Specific Changes');
    const qualityScore = extractQualityScore(aiText);

    return NextResponse.json({
      success: true,
      data: {
        analysis: analysis || 'Analysis not available',
        enhancedContent: enhancedContent || aiText, // Fallback to full response
        changes: changes || 'Changes not detailed',
        qualityScore: qualityScore || { score: 7, justification: 'Default quality assessment' },
        metadata: {
          originalTitle: validatedData.title,
          contentType: validatedData.contentType,
          enhancementType: validatedData.enhancementType,
          enhancedAt: new Date().toISOString()
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
    }, 'AI content enhancement failed');

    return NextResponse.json({
      error: 'Content enhancement failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to extract sections from AI response
function extractSection(text: string, sectionName: string): string | null {
  const regex = new RegExp(`${sectionName}:([\\s\\S]*?)(?=\\n\\d+\\.|\\n\\*\\*|$)`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

// Helper function to extract quality score
function extractQualityScore(text: string): { score: number; justification: string } | null {
  const scoreMatch = text.match(/Quality Score:?\s*(\d+)/i);
  if (scoreMatch) {
    const score = parseInt(scoreMatch[1]);
    const justificationMatch = text.match(/Quality Score:[\s\S]*?(?=\\n\\d+\\.|\\n\\*\\*|$)/);
    const justification = justificationMatch ? justificationMatch[0].replace(/Quality Score:?\s*\d+/i, '').trim() : 'Quality assessment provided';
    return { score: Math.min(Math.max(score, 1), 10), justification };
  }
  return null;
}