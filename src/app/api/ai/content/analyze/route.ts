import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AiService } from '@/services/ai/AiService';
import { AiRequest } from '@/services/ai/providers/IAiProvider';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schema for content analysis
const contentAnalysisSchema = z.object({
  contentId: z.string().optional(),
  title: z.string().min(1),
  content: z.string().min(10),
  contentType: z.enum(['article', 'exercise', 'video', 'audio', 'assessment', 'resource']),
  targetAudience: z.array(z.enum(['general', 'professionals', 'patients', 'caregivers'])).min(1),
  category: z.array(z.string()).min(1),
  analysisType: z.enum(['quality', 'engagement', 'safety', 'accessibility', 'comprehensiveness', 'full_analysis']).default('full_analysis')
});

// Content analysis prompts
const getAnalysisPrompt = (params: z.infer<typeof contentAnalysisSchema>) => {
  const { title, content, contentType, targetAudience, category, analysisType } = params;

  const audienceText = targetAudience.join(', ');
  const categoryText = category.join(', ');

  const analysisFocus = {
    quality: 'Focus on overall content quality, accuracy, and effectiveness for mental health support.',
    engagement: 'Analyze engagement potential, readability, and user experience factors.',
    safety: 'Review for mental health safety, appropriate disclaimers, and crisis resource inclusion.',
    accessibility: 'Evaluate accessibility, inclusive language, and comprehension for diverse audiences.',
    comprehensiveness: 'Assess completeness, depth, and coverage of relevant mental health topics.',
    full_analysis: 'Provide comprehensive analysis across all quality dimensions.'
  };

  const basePrompt = `You are a mental health content quality analyst. Analyze the following content and provide detailed feedback.

CONTENT TITLE: ${title}
CONTENT TYPE: ${contentType}
TARGET AUDIENCE: ${audienceText}
CATEGORY: ${categoryText}
ANALYSIS FOCUS: ${analysisFocus[analysisType]}

CONTENT TO ANALYZE:
${content}

ANALYSIS CRITERIA FOR MENTAL HEALTH CONTENT:

**Quality Metrics (1-10 scale):**
1. **Evidence-Based Accuracy**: Does the content reflect current mental health research and best practices?
2. **Clarity & Readability**: Is the information presented clearly and at appropriate reading level?
3. **Empowerment Focus**: Does content promote self-efficacy and positive mental health strategies?
4. **Safety & Ethics**: Are appropriate disclaimers included? Crisis resources mentioned?
5. **Cultural Sensitivity**: Is language inclusive and culturally appropriate?
6. **Practical Value**: Does content provide actionable, helpful information?
7. **Engagement**: Is content engaging and likely to hold reader attention?
8. **Accessibility**: Is content accessible to diverse audiences and abilities?

**Specific Analysis Areas:**
- Strengths and positive aspects
- Areas for improvement
- Potential trigger content or safety concerns
- Missing information or resources
- Suggestions for enhancement
- Overall quality score (1-10)

**Output Format:**
Provide your analysis in the following structure:
1. **Overall Quality Score**: [score]/10
2. **Strengths**: [list key strengths]
3. **Areas for Improvement**: [list specific recommendations]
4. **Safety Assessment**: [safety concerns and recommendations]
5. **Enhancement Suggestions**: [specific actionable improvements]
6. **Final Recommendation**: [publish as-is, needs revision, or reject with reasoning]

Ensure your analysis is constructive, evidence-based, and focused on improving mental health content quality.`;

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
    const validatedData = contentAnalysisSchema.parse(body);

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

    // Generate analysis prompt
    const prompt = getAnalysisPrompt(validatedData);

    // Prepare AI request
    const aiRequest: AiRequest = {
      prompt,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.2, // Low temperature for consistent analysis
      maxTokens: 4000, // Sufficient for detailed analysis
      context: {
        messages: [{
          role: 'system',
          content: 'You are an expert mental health content analyst providing objective, constructive feedback focused on quality, safety, and effectiveness.',
          timestamp: new Date()
        }]
      }
    };

    logger.info({
      userId,
      contentId: validatedData.contentId,
      title: validatedData.title,
      analysisType: validatedData.analysisType
    }, 'Analyzing content with AI');

    // Generate analysis
    const response = await aiService.generateText(aiRequest);

    // Parse the AI response to extract structured data
    const aiText = response.text;

    // Extract structured analysis components
    const analysis = {
      overallScore: extractScore(aiText),
      strengths: extractSection(aiText, 'Strengths'),
      improvements: extractSection(aiText, 'Areas for Improvement'),
      safetyAssessment: extractSection(aiText, 'Safety Assessment'),
      enhancementSuggestions: extractSection(aiText, 'Enhancement Suggestions'),
      finalRecommendation: extractSection(aiText, 'Final Recommendation'),
      rawAnalysis: aiText
    };

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        metadata: {
          contentId: validatedData.contentId,
          title: validatedData.title,
          contentType: validatedData.contentType,
          analysisType: validatedData.analysisType,
          analyzedAt: new Date().toISOString()
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
    }, 'AI content analysis failed');

    return NextResponse.json({
      error: 'Content analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions for parsing AI response
function extractScore(text: string): number {
  const scoreMatch = text.match(/Overall Quality Score:?\s*(\d+)/i);
  if (scoreMatch) {
    const score = parseInt(scoreMatch[1]);
    return Math.min(Math.max(score, 1), 10);
  }
  return 7; // Default score
}

function extractSection(text: string, sectionName: string): string {
  const patterns = [
    new RegExp(`${sectionName}:([\\s\\S]*?)(?=\\n\\d+\\.|\\n\\*\\*|$)`),
    new RegExp(`\\*\\*${sectionName}\\*\\*:([\\s\\S]*?)(?=\\n\\*\\*|$)`),
    new RegExp(`${sectionName}([\\s\\S]*?)(?=\\n\\d+\\.|\\n\\*\\*|$)`)
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  return `Section "${sectionName}" not found in analysis`;
}