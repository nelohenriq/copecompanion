
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PersonalizationService } from '@/services/personalization/PersonalizationService';
import { AiService } from '@/services/ai/AiService';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Initialize services (shared instances)
let personalizationService: PersonalizationService;
let aiService: AiService;

function getPersonalizationService(): PersonalizationService {
  if (!personalizationService) {
    if (!aiService) {
      aiService = new AiService({
        userId: 'system', // System-level service
        cacheEnabled: true,
        cacheTtl: 3600,
      });
    }
    personalizationService = new PersonalizationService(aiService);
  }
  return personalizationService;
}

// GET /api/personalization - Get user preferences and recommendations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const service = getPersonalizationService();

    // Get user preferences
    const preferences = await service['getUserPreferences'](userId);

    // Get conversation patterns (anonymized)
    const patterns = await service.analyzeConversationPatterns(userId);

    // Get content recommendations
    const recommendations = await service.generateRecommendations(userId, {
      userId,
      preferences: preferences,
      patterns: patterns,
      recentTopics: [],
      emotionalState: 'neutral',
    });

    return NextResponse.json({
      success: true,
      data: {
        preferences: {
          ...preferences,
          // Don't expose sensitive data
          dataSharingConsent: preferences.dataSharingConsent,
          personalizationEnabled: preferences.personalizationEnabled,
        },
        recommendations,
        patterns: {
          commonTopics: patterns.commonTopics,
          emotionalTone: patterns.emotionalTone,
          responseLength: patterns.responseLength,
          communicationStyle: patterns.communicationStyle,
        },
      },
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to get personalization data');

    return NextResponse.json({
      error: 'Failed to retrieve personalization data',
    }, { status: 500 });
  }
}

// PUT /api/personalization - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json();

    const service = getPersonalizationService();

    // Validate input
    const allowedFields = [
      'tone',
      'communicationStyle',
      'preferredTopics',
      'avoidedTopics',
      'personalizationEnabled',
      'dataSharingConsent'
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Validate arrays
    if (updates.preferredTopics && !Array.isArray(updates.preferredTopics)) {
      return NextResponse.json({ error: 'preferredTopics must be an array' }, { status: 400 });
    }
    if (updates.avoidedTopics && !Array.isArray(updates.avoidedTopics)) {
      return NextResponse.json({ error: 'avoidedTopics must be an array' }, { status: 400 });
    }

    // Validate boolean fields
    if (updates.personalizationEnabled !== undefined && typeof updates.personalizationEnabled !== 'boolean') {
      return NextResponse.json({ error: 'personalizationEnabled must be a boolean' }, { status: 400 });
    }
    if (updates.dataSharingConsent !== undefined && typeof updates.dataSharingConsent !== 'boolean') {
      return NextResponse.json({ error: 'dataSharingConsent must be a boolean' }, { status: 400 });
    }

    await service.updateUserPreferences(userId, updates);

    logger.info({
      userId,
      updatedFields: Object.keys(updates)
    }, 'User preferences updated');

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to update personalization preferences');

    return NextResponse.json({
      error: 'Failed to update preferences',
    }, { status: 500 });
  }
}