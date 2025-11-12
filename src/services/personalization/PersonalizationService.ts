import { AiService } from '../ai/AiService';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

export interface UserPreferences {
  tone?: string;
  communicationStyle?: string;
  preferredTopics: string[];
  avoidedTopics: string[];
  personalizationEnabled: boolean;
  dataSharingConsent: boolean;
}

export interface ConversationPattern {
  commonTopics: string[];
  emotionalTone: string;
  responseLength: 'short' | 'medium' | 'long';
  communicationStyle: string;
  preferredResponseTime: 'immediate' | 'reflective';
}

export interface ContentRecommendation {
  id: string;
  contentType: string;
  title: string;
  description?: string;
  url?: string;
  tags: string[];
  relevanceScore: number;
  confidence: number;
}

export interface PersonalizationContext {
  userId: string;
  preferences: UserPreferences;
  patterns: ConversationPattern;
  recentTopics: string[];
  emotionalState: string;
}

export class PersonalizationService {
  private aiService: AiService;

  constructor(aiService: AiService) {
    this.aiService = aiService;
  }

  /**
   * Personalize an AI response based on user preferences and patterns
   */
  async personalizeResponse(
    baseResponse: string,
    userId: string,
    conversationContext: string[]
  ): Promise<string> {
    try {
      // Get user preferences and patterns
      const context = await this.buildPersonalizationContext(userId, conversationContext);

      if (!context.preferences.personalizationEnabled) {
        return baseResponse; // Return unmodified response if personalization is disabled
      }

      // Apply personalization transformations
      let personalizedResponse = baseResponse;

      // Adjust tone and communication style
      personalizedResponse = await this.adjustToneAndStyle(personalizedResponse, context);

      // Adapt content based on preferences
      personalizedResponse = this.adaptContentToPreferences(personalizedResponse, context);

      // Add personalized recommendations if appropriate
      const recommendations = await this.generateRecommendations(userId, context);
      if (recommendations.length > 0 && this.shouldIncludeRecommendations(baseResponse)) {
        personalizedResponse += this.formatRecommendations(recommendations);
      }

      logger.info({
        userId,
        originalLength: baseResponse.length,
        personalizedLength: personalizedResponse.length,
        recommendationsCount: recommendations.length
      }, 'Response personalized successfully');

      return personalizedResponse;

    } catch (error) {
      logger.error({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Personalization failed, returning base response');

      return baseResponse; // Fallback to base response on error
    }
  }

  /**
   * Generate content recommendations for the user
   */
  async generateRecommendations(
    userId: string,
    context: PersonalizationContext,
    limit: number = 3
  ): Promise<ContentRecommendation[]> {
    try {
      const recommendations: ContentRecommendation[] = [];

      // Get existing recommendations to avoid duplicates
      const existingRecs = await prisma.contentRecommendation.findMany({
        where: { userId, viewed: false },
        orderBy: { relevanceScore: 'desc' },
        take: limit,
      });

      if (existingRecs.length >= limit) {
        return existingRecs.map(this.formatRecommendationFromDb);
      }

      // Generate new recommendations based on user patterns
      const newRecommendations = await this.generateNewRecommendations(context, limit - existingRecs.length);

      // Store new recommendations
      for (const rec of newRecommendations) {
        await prisma.contentRecommendation.create({
          data: {
            userId,
            contentType: rec.contentType,
            title: rec.title,
            description: rec.description,
            url: rec.url,
            tags: rec.tags,
            relevanceScore: rec.relevanceScore,
            confidence: rec.confidence,
          },
        });
      }

      // Return combined recommendations
      const allRecs = await prisma.contentRecommendation.findMany({
        where: { userId, viewed: false },
        orderBy: { relevanceScore: 'desc' },
        take: limit,
      });

      return allRecs.map(this.formatRecommendationFromDb);

    } catch (error) {
      logger.error({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to generate recommendations');

      return [];
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    try {
      await prisma.userPreferences.upsert({
        where: { userId },
        update: preferences,
        create: {
          userId,
          ...preferences,
          personalizationEnabled: preferences.personalizationEnabled ?? true,
          dataSharingConsent: preferences.dataSharingConsent ?? false,
          preferredTopics: preferences.preferredTopics ?? [],
          avoidedTopics: preferences.avoidedTopics ?? [],
        },
      });

      logger.info({ userId }, 'User preferences updated');

    } catch (error) {
      logger.error({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update user preferences');

      throw error;
    }
  }

  /**
   * Analyze conversation patterns from user's history
   */
  async analyzeConversationPatterns(userId: string): Promise<ConversationPattern> {
    try {
      // Get recent conversations
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 50, // Analyze last 50 messages
          },
        },
        orderBy: { lastActivity: 'desc' },
        take: 5, // Last 5 conversations
      });

      const allMessages = conversations.flatMap(conv => conv.messages).reverse(); // Chronological order

      if (allMessages.length === 0) {
        return this.getDefaultPatterns();
      }

      // Analyze patterns
      const topics = this.extractTopics(allMessages);
      const emotionalTone = this.analyzeEmotionalTone(allMessages);
      const responseLength = this.determinePreferredLength(allMessages);
      const communicationStyle = this.analyzeCommunicationStyle(allMessages);

      const patterns: ConversationPattern = {
        commonTopics: topics.slice(0, 5), // Top 5 topics
        emotionalTone,
        responseLength,
        communicationStyle,
        preferredResponseTime: 'reflective', // Default for mental health context
      };

      // Store patterns for future use
      await this.updateStoredPatterns(userId, patterns);

      return patterns;

    } catch (error) {
      logger.error({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to analyze conversation patterns');

      return this.getDefaultPatterns();
    }
  }

  /**
   * Mark recommendation as viewed or interacted with
   */
  async updateRecommendationInteraction(
    recommendationId: string,
    userId: string,
    action: 'viewed' | 'interacted'
  ): Promise<void> {
    try {
      const updateData: any = {
        [action]: true,
        [`${action}At`]: new Date(),
      };

      await prisma.contentRecommendation.updateMany({
        where: { id: recommendationId, userId },
        data: updateData,
      });

      logger.info({
        recommendationId,
        userId,
        action
      }, 'Recommendation interaction updated');

    } catch (error) {
      logger.error({
        recommendationId,
        userId,
        action,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update recommendation interaction');
    }
  }

  // Private methods

  private async buildPersonalizationContext(
    userId: string,
    conversationContext: string[]
  ): Promise<PersonalizationContext> {
    const preferences = await this.getUserPreferences(userId);
    const patterns = await this.analyzeConversationPatterns(userId);
    const recentTopics = this.extractTopicsFromContext(conversationContext);
    const emotionalState = this.analyzeEmotionalState(conversationContext);

    return {
      userId,
      preferences,
      patterns,
      recentTopics,
      emotionalState,
    };
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const prefs = await prisma.userPreferences.findUnique({
        where: { userId },
      });

      if (!prefs) {
        // Create default preferences
        const defaultPrefs = {
          personalizationEnabled: true,
          dataSharingConsent: false,
          preferredTopics: [],
          avoidedTopics: [],
        };

        await this.updateUserPreferences(userId, defaultPrefs);
        return defaultPrefs;
      }

      return {
        tone: prefs.tone || undefined,
        communicationStyle: prefs.communicationStyle || undefined,
        preferredTopics: prefs.preferredTopics,
        avoidedTopics: prefs.avoidedTopics,
        personalizationEnabled: prefs.personalizationEnabled,
        dataSharingConsent: prefs.dataSharingConsent,
      };

    } catch (error) {
      logger.warn({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get user preferences, using defaults');

      return {
        personalizationEnabled: true,
        dataSharingConsent: false,
        preferredTopics: [],
        avoidedTopics: [],
      };
    }
  }

  private async adjustToneAndStyle(response: string, context: PersonalizationContext): Promise<string> {
    if (!context.preferences.tone && !context.preferences.communicationStyle) {
      return response;
    }

    try {
      const prompt = `
Adjust the tone and communication style of this response based on user preferences.

User preferences:
- Tone: ${context.preferences.tone || 'neutral'}
- Communication style: ${context.preferences.communicationStyle || 'balanced'}

Original response: "${response}"

Return only the adjusted response, maintaining the same meaning but adapted to the preferred tone and style.
      `;

      const adjustedResponse = await this.aiService.generateText({
        prompt,
        temperature: 0.3, // Low temperature for consistent style adjustment
      });

      return adjustedResponse.text;

    } catch (error) {
      logger.warn('Tone adjustment failed, returning original response');
      return response;
    }
  }

  private adaptContentToPreferences(response: string, context: PersonalizationContext): string {
    let adaptedResponse = response;

    // Avoid topics the user doesn't want to discuss
    if (context.preferences.avoidedTopics.length > 0) {
      // Simple filtering - in production, this would be more sophisticated
      const lowerResponse = adaptedResponse.toLowerCase();
      const containsAvoidedTopic = context.preferences.avoidedTopics.some(topic =>
        lowerResponse.includes(topic.toLowerCase())
      );

      if (containsAvoidedTopic) {
        adaptedResponse += " (Note: If you'd prefer not to discuss certain topics, you can let me know.)";
      }
    }

    return adaptedResponse;
  }

  private async generateNewRecommendations(
    context: PersonalizationContext,
    count: number
  ): Promise<ContentRecommendation[]> {
    const recommendations: ContentRecommendation[] = [];

    // Generate recommendations based on user's interests and conversation patterns
    const topics = [...context.patterns.commonTopics, ...context.preferences.preferredTopics];

    if (topics.includes('anxiety') || topics.includes('stress')) {
      recommendations.push({
        id: `rec-${Date.now()}-1`,
        contentType: 'exercise',
        title: 'Guided Breathing Exercise',
        description: 'A simple 5-minute breathing exercise to help manage stress and anxiety.',
        tags: ['anxiety', 'stress', 'breathing', 'mindfulness'],
        relevanceScore: 0.8,
        confidence: 0.7,
      });
    }

    if (topics.includes('depression') || topics.includes('mood')) {
      recommendations.push({
        id: `rec-${Date.now()}-2`,
        contentType: 'article',
        title: 'Understanding Depression: Common Signs and Support',
        description: 'Learn about depression symptoms and available support resources.',
        tags: ['depression', 'mental-health', 'support'],
        relevanceScore: 0.9,
        confidence: 0.8,
      });
    }

    if (topics.includes('sleep') || topics.includes('insomnia')) {
      recommendations.push({
        id: `rec-${Date.now()}-3`,
        contentType: 'resource',
        title: 'Sleep Hygiene Tips',
        description: 'Evidence-based tips for improving sleep quality.',
        tags: ['sleep', 'insomnia', 'health'],
        relevanceScore: 0.7,
        confidence: 0.6,
      });
    }

    // Add general mental health resources if no specific topics
    if (recommendations.length < count) {
      recommendations.push({
        id: `rec-${Date.now()}-4`,
        contentType: 'resource',
        title: 'Mental Health Support Directory',
        description: 'Find local and national mental health resources and hotlines.',
        tags: ['support', 'resources', 'help'],
        relevanceScore: 0.6,
        confidence: 0.9,
      });
    }

    return recommendations.slice(0, count);
  }

  private shouldIncludeRecommendations(response: string): boolean {
    // Only include recommendations in certain contexts
    const lowerResponse = response.toLowerCase();
    return lowerResponse.includes('recommend') ||
           lowerResponse.includes('suggest') ||
           lowerResponse.includes('resource') ||
           lowerResponse.includes('help');
  }

  private formatRecommendations(recommendations: ContentRecommendation[]): string {
    if (recommendations.length === 0) return '';

    let formatted = '\n\nBased on our conversation, here are some resources that might be helpful:\n';
    recommendations.slice(0, 2).forEach((rec, index) => {
      formatted += `${index + 1}. ${rec.title}`;
      if (rec.description) {
        formatted += ` - ${rec.description}`;
      }
      formatted += '\n';
    });

    return formatted;
  }

  private extractTopics(messages: any[]): string[] {
    const topicCounts: Record<string, number> = {};

    // Simple keyword-based topic extraction
    const topicKeywords = {
      anxiety: ['anxiety', 'anxious', 'worry', 'panic', 'stress'],
      depression: ['depression', 'depressed', 'sad', 'hopeless', 'mood'],
      sleep: ['sleep', 'insomnia', 'tired', 'rest', 'nightmare'],
      relationships: ['relationship', 'friend', 'family', 'partner', 'social'],
      work: ['work', 'job', 'career', 'stress', 'boss', 'colleague'],
      self_esteem: ['confidence', 'self-esteem', 'worth', 'value', 'insecure'],
    };

    messages.forEach(message => {
      const content = message.content.toLowerCase();
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(keyword => content.includes(keyword))) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      }
    });

    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([topic]) => topic);
  }

  private analyzeEmotionalTone(messages: any[]): string {
    let positiveCount = 0;
    let negativeCount = 0;

    const positiveWords = ['happy', 'good', 'great', 'excellent', 'wonderful', 'hopeful'];
    const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hopeless', 'worried'];

    messages.forEach(message => {
      const content = message.content.toLowerCase();
      positiveCount += positiveWords.filter(word => content.includes(word)).length;
      negativeCount += negativeWords.filter(word => content.includes(word)).length;
    });

    if (positiveCount > negativeCount * 1.5) return 'positive';
    if (negativeCount > positiveCount * 1.5) return 'negative';
    return 'neutral';
  }

  private determinePreferredLength(messages: any[]): 'short' | 'medium' | 'long' {
    const userMessages = messages.filter((m: any) => m.role === 'user');
    if (userMessages.length === 0) return 'medium';

    const avgLength = userMessages.reduce((sum: number, m: any) => sum + m.content.length, 0) / userMessages.length;

    if (avgLength < 50) return 'short';
    if (avgLength > 200) return 'long';
    return 'medium';
  }

  private analyzeCommunicationStyle(messages: any[]): string {
    // Simple analysis based on message patterns
    const userMessages = messages.filter((m: any) => m.role === 'user');

    if (userMessages.length < 5) return 'neutral';

    const questionCount = userMessages.filter((m: any) =>
      m.content.includes('?')
    ).length;

    const questionRatio = questionCount / userMessages.length;

    if (questionRatio > 0.3) return 'inquisitive';
    if (questionRatio < 0.1) return 'reflective';

    return 'conversational';
  }

  private extractTopicsFromContext(context: string[]): string[] {
    return this.extractTopics(context.map(content => ({ content })));
  }

  private analyzeEmotionalState(context: string[]): string {
    const recentMessages = context.slice(-5); // Last 5 messages
    return this.analyzeEmotionalTone(recentMessages.map(content => ({ content })));
  }

  private getDefaultPatterns(): ConversationPattern {
    return {
      commonTopics: [],
      emotionalTone: 'neutral',
      responseLength: 'medium',
      communicationStyle: 'conversational',
      preferredResponseTime: 'reflective',
    };
  }

  private async updateStoredPatterns(userId: string, patterns: ConversationPattern): Promise<void> {
    try {
      await (prisma as any).userPreferences.update({
        where: { userId },
        data: {
          conversationPatterns: patterns,
        },
      });
    } catch (error) {
      // Ignore errors in pattern storage
    }
  }

  private formatRecommendationFromDb(dbRec: any): ContentRecommendation {
    return {
      id: dbRec.id,
      contentType: dbRec.contentType,
      title: dbRec.title,
      description: dbRec.description,
      url: dbRec.url,
      tags: dbRec.tags,
      relevanceScore: dbRec.relevanceScore,
      confidence: dbRec.confidence,
    };
  }
}