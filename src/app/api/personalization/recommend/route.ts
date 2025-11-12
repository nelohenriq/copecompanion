import { NextRequest, NextResponse } from 'next/server';
import { PersonalizationEngine, PersonalizationContext, InteractionSuggestion } from '@/services/personalization/PersonalizationEngine';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schema for personalization request
const personalizationRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  context: z.object({
    currentSession: z.object({
      startTime: z.string().datetime(),
      interactions: z.number().min(0),
      contentViewed: z.array(z.string()),
      emotionalStates: z.array(z.string())
    }),
    recentHistory: z.object({
      last7Days: z.object({
        sessions: z.number().min(0),
        avgDuration: z.number().min(0),
        topContentTypes: z.array(z.string()),
        emotionalVariability: z.number().min(0).max(1)
      })
    }),
    environmentalFactors: z.object({
      timeOfDay: z.number().min(0).max(23),
      deviceType: z.string(),
      location: z.string().optional(),
      networkQuality: z.enum(['slow', 'normal', 'fast'])
    })
  }),
  availableContent: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    features: z.record(z.string(), z.any())
  })).optional(),
  includeSuggestions: z.boolean().optional()
});

const personalizationEngine = new PersonalizationEngine();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = personalizationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { userId, context: rawContext, availableContent = [], includeSuggestions = false } = validationResult.data;

    // Convert context to proper types
    const context: PersonalizationContext = {
      userId,
      currentSession: {
        ...rawContext.currentSession,
        startTime: new Date(rawContext.currentSession.startTime)
      },
      recentHistory: rawContext.recentHistory,
      environmentalFactors: rawContext.environmentalFactors
    };

    // Generate content recommendations
    const recommendations = await personalizationEngine.generateContentRecommendations(
      userId,
      context,
      availableContent
    );

    // Generate interaction suggestions if requested
    let suggestions: InteractionSuggestion[] = [];
    if (includeSuggestions) {
      suggestions = await personalizationEngine.generateInteractionSuggestions(userId, context);
    }

    // Get user profile summary
    const profile = await personalizationEngine.getUserProfile(userId);
    const profileSummary = {
      confidence: profile.confidence,
      preferences: profile.preferences,
      behavioralPatterns: {
        sessionFrequency: profile.behavioralPatterns.sessionFrequency,
        preferredTimes: profile.behavioralPatterns.preferredTimes,
        interactionDepth: profile.behavioralPatterns.interactionDepth
      },
      emotionalProfile: {
        baselineMood: profile.emotionalProfile.baselineMood,
        supportNeeds: profile.emotionalProfile.supportNeeds
      }
    };

    logger.info({
      userId,
      recommendationsCount: recommendations.length,
      suggestionsCount: suggestions.length,
      profileConfidence: profile.confidence
    }, 'Personalization recommendations generated');

    return NextResponse.json({
      recommendations,
      suggestions,
      profile: profileSummary,
      personalizationStats: personalizationEngine.getPersonalizationStats(),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to generate personalization recommendations');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process personalization request'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user profile
    const profile = await personalizationEngine.getUserProfile(userId);

    // Get personalization stats
    const stats = personalizationEngine.getPersonalizationStats();

    return NextResponse.json({
      profile: {
        userId: profile.userId,
        confidence: profile.confidence,
        lastUpdated: profile.lastUpdated,
        preferences: profile.preferences,
        behavioralPatterns: profile.behavioralPatterns,
        emotionalProfile: profile.emotionalProfile
      },
      stats,
      federatedLearningStats: {
        models: {} // Would include federated learning model stats
      }
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to get user personalization profile');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve personalization profile'
      },
      { status: 500 }
    );
  }
}