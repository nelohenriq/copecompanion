import { FederatedLearningService, FederatedModel } from './FederatedLearningService';
import { logger } from '@/lib/logger';

export interface UserProfile {
  userId: string;
  preferences: {
    contentTypes: string[];
    interactionStyles: string[];
    emotionalTriggers: string[];
    learningPreferences: string[];
  };
  behavioralPatterns: {
    sessionFrequency: number;
    preferredTimes: number[];
    interactionDepth: number;
    contentEngagement: Record<string, number>;
  };
  emotionalProfile: {
    baselineMood: string;
    stressTriggers: string[];
    copingStrategies: string[];
    supportNeeds: string[];
  };
  personalizationModels: {
    contentPreference: FederatedModel | null;
    interactionPattern: FederatedModel | null;
    emotionalResponse: FederatedModel | null;
  };
  lastUpdated: Date;
  confidence: number;
}

export interface PersonalizationContext {
  userId: string;
  currentSession: {
    startTime: Date;
    interactions: number;
    contentViewed: string[];
    emotionalStates: string[];
  };
  recentHistory: {
    last7Days: {
      sessions: number;
      avgDuration: number;
      topContentTypes: string[];
      emotionalVariability: number;
    };
  };
  environmentalFactors: {
    timeOfDay: number;
    deviceType: string;
    location?: string;
    networkQuality: 'slow' | 'normal' | 'fast';
  };
}

export interface ContentRecommendation {
  contentId: string;
  title: string;
  type: string;
  relevanceScore: number;
  personalizationFactors: {
    emotionalAlignment: number;
    behavioralMatch: number;
    contextualFit: number;
    collaborativeFilter: number;
  };
  reasoning: string;
  confidence: number;
}

export interface InteractionSuggestion {
  type: 'prompt' | 'feature' | 'content' | 'break';
  title: string;
  description: string;
  timing: 'immediate' | 'soon' | 'later';
  emotionalContext: string[];
  expectedOutcome: string;
  confidence: number;
}

export class PersonalizationEngine {
  private federatedLearning: FederatedLearningService;
  private userProfiles: Map<string, UserProfile> = new Map();
  private recommendationCache: Map<string, ContentRecommendation[]> = new Map();

  constructor() {
    this.federatedLearning = new FederatedLearningService();
    this.initializePersonalizationEngine();
  }

  private initializePersonalizationEngine() {
    // Initialize personalization models and monitoring
    logger.info('Personalization engine initialized');
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      profile = await this.createUserProfile(userId);
      this.userProfiles.set(userId, profile);
    }

    // Update profile with latest data
    profile = await this.updateUserProfile(profile);

    return profile;
  }

  private async createUserProfile(userId: string): Promise<UserProfile> {
    // Initialize with default preferences and models
    const profile: UserProfile = {
      userId,
      preferences: {
        contentTypes: ['educational', 'supportive'],
        interactionStyles: ['conversational', 'structured'],
        emotionalTriggers: [],
        learningPreferences: ['visual', 'textual']
      },
      behavioralPatterns: {
        sessionFrequency: 1,
        preferredTimes: [9, 10, 11, 14, 15, 16, 19, 20], // Default business hours
        interactionDepth: 0.5,
        contentEngagement: {}
      },
      emotionalProfile: {
        baselineMood: 'neutral',
        stressTriggers: [],
        copingStrategies: ['breathing', 'journaling'],
        supportNeeds: ['emotional', 'practical']
      },
      personalizationModels: {
        contentPreference: await this.federatedLearning.getPersonalizedModel(userId, 'content-preference'),
        interactionPattern: await this.federatedLearning.getPersonalizedModel(userId, 'interaction-pattern'),
        emotionalResponse: await this.federatedLearning.getPersonalizedModel(userId, 'emotional-response')
      },
      lastUpdated: new Date(),
      confidence: 0.3 // Low initial confidence
    };

    logger.info({ userId }, 'New user profile created');
    return profile;
  }

  private async updateUserProfile(profile: UserProfile): Promise<UserProfile> {
    try {
      // Update with recent behavioral data
      const recentData = await this.getRecentUserData(profile.userId);

      // Update behavioral patterns
      profile.behavioralPatterns = this.updateBehavioralPatterns(
        profile.behavioralPatterns,
        recentData
      );

      // Update emotional profile
      profile.emotionalProfile = this.updateEmotionalProfile(
        profile.emotionalProfile,
        recentData
      );

      // Update personalization models
      profile.personalizationModels = {
        contentPreference: await this.federatedLearning.getPersonalizedModel(profile.userId, 'content-preference'),
        interactionPattern: await this.federatedLearning.getPersonalizedModel(profile.userId, 'interaction-pattern'),
        emotionalResponse: await this.federatedLearning.getPersonalizedModel(profile.userId, 'emotional-response')
      };

      // Increase confidence as we learn more
      profile.confidence = Math.min(profile.confidence + 0.1, 0.95);
      profile.lastUpdated = new Date();

      this.userProfiles.set(profile.userId, profile);

      logger.debug({
        userId: profile.userId,
        confidence: profile.confidence
      }, 'User profile updated');

      return profile;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: profile.userId
      }, 'Failed to update user profile');
      return profile;
    }
  }

  private updateBehavioralPatterns(
    current: UserProfile['behavioralPatterns'],
    recentData: any
  ): UserProfile['behavioralPatterns'] {
    // Update session frequency
    const sessionsLastWeek = recentData.sessionsLastWeek || 0;
    current.sessionFrequency = (current.sessionFrequency + sessionsLastWeek / 7) / 2;

    // Update preferred times based on session data
    if (recentData.sessionTimes) {
      const timeCounts = recentData.sessionTimes.reduce((acc: Record<number, number>, time: number) => {
        const hour = Math.floor(time / 60);
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      const topHours = Object.entries(timeCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 8)
        .map(([hour]) => parseInt(hour));

      current.preferredTimes = topHours.length > 0 ? topHours : current.preferredTimes;
    }

    // Update content engagement
    if (recentData.contentInteractions) {
      for (const [contentType, engagement] of Object.entries(recentData.contentInteractions)) {
        current.contentEngagement[contentType] =
          (current.contentEngagement[contentType] || 0) * 0.7 + (engagement as number) * 0.3;
      }
    }

    return current;
  }

  private updateEmotionalProfile(
    current: UserProfile['emotionalProfile'],
    recentData: any
  ): UserProfile['emotionalProfile'] {
    if (recentData.emotionalPatterns) {
      // Update baseline mood based on recent emotional states
      const emotions = recentData.emotionalPatterns;
      const mostCommon = this.getMostCommonEmotion(emotions);
      current.baselineMood = mostCommon;

      // Identify stress triggers from emotional correlations
      if (recentData.stressCorrelations) {
        current.stressTriggers = Object.keys(recentData.stressCorrelations)
          .filter(trigger => recentData.stressCorrelations[trigger] > 0.7)
          .slice(0, 5);
      }
    }

    return current;
  }

  private getMostCommonEmotion(emotions: string[]): string {
    const counts: Record<string, number> = {};
    emotions.forEach(emotion => {
      counts[emotion] = (counts[emotion] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'neutral';
  }

  private async getRecentUserData(userId: string): Promise<any> {
    // This would query actual user data from database
    // For now, return mock data
    return {
      sessionsLastWeek: 5,
      sessionTimes: [540, 600, 780, 900, 1080], // Minutes since midnight
      contentInteractions: {
        educational: 0.8,
        supportive: 0.9,
        interactive: 0.6
      },
      emotionalPatterns: ['calm', 'focused', 'calm', 'anxious', 'calm'],
      stressCorrelations: {
        'work_pressure': 0.8,
        'time_pressure': 0.6,
        'social_interaction': 0.3
      }
    };
  }

  async generateContentRecommendations(
    userId: string,
    context: PersonalizationContext,
    availableContent: Array<{ id: string; title: string; type: string; features: Record<string, any> }>
  ): Promise<ContentRecommendation[]> {
    try {
      const profile = await this.getUserProfile(userId);
      const cacheKey = `${userId}-${Date.now()}`;

      // Check cache first
      const cached = this.recommendationCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const recommendations: ContentRecommendation[] = [];

      for (const content of availableContent) {
        const recommendation = await this.scoreContentForUser(content, profile, context);
        recommendations.push(recommendation);
      }

      // Sort by relevance and take top recommendations
      recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const topRecommendations = recommendations.slice(0, 10);

      // Cache results for 30 minutes
      this.recommendationCache.set(cacheKey, topRecommendations);
      setTimeout(() => this.recommendationCache.delete(cacheKey), 30 * 60 * 1000);

      logger.debug({
        userId,
        contentCount: availableContent.length,
        recommendationsCount: topRecommendations.length
      }, 'Content recommendations generated');

      return topRecommendations;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to generate content recommendations');

      // Return basic recommendations as fallback
      return availableContent.slice(0, 5).map(content => ({
        contentId: content.id,
        title: content.title,
        type: content.type,
        relevanceScore: 0.5,
        personalizationFactors: {
          emotionalAlignment: 0.5,
          behavioralMatch: 0.5,
          contextualFit: 0.5,
          collaborativeFilter: 0.5
        },
        reasoning: 'Fallback recommendation due to personalization error',
        confidence: 0.3
      }));
    }
  }

  private async scoreContentForUser(
    content: any,
    profile: UserProfile,
    context: PersonalizationContext
  ): Promise<ContentRecommendation> {
    // Multi-factor scoring
    const emotionalAlignment = await this.calculateEmotionalAlignment(content, profile, context);
    const behavioralMatch = this.calculateBehavioralMatch(content, profile);
    const contextualFit = this.calculateContextualFit(content, context);
    const collaborativeFilter = await this.calculateCollaborativeFilter(content, profile);

    // Weighted combination
    const relevanceScore = (
      emotionalAlignment * 0.4 +
      behavioralMatch * 0.3 +
      contextualFit * 0.2 +
      collaborativeFilter * 0.1
    );

    const reasoning = this.generateRecommendationReasoning({
      emotionalAlignment,
      behavioralMatch,
      contextualFit,
      collaborativeFilter
    });

    return {
      contentId: content.id,
      title: content.title,
      type: content.type,
      relevanceScore,
      personalizationFactors: {
        emotionalAlignment,
        behavioralMatch,
        contextualFit,
        collaborativeFilter
      },
      reasoning,
      confidence: profile.confidence
    };
  }

  private async calculateEmotionalAlignment(
    content: any,
    profile: UserProfile,
    context: PersonalizationContext
  ): Promise<number> {
    // Use federated emotional response model
    if (profile.personalizationModels.emotionalResponse) {
      try {
        // Create feature vector from content and emotional context
        const features = this.extractEmotionalFeatures(content, context);
        const prediction = await this.federatedLearning.predictWithFederatedModel(
          'emotional-response',
          features
        );

        // Find best matching emotion for user's current state
        const currentEmotionIndex = this.emotionToIndex(context.currentSession.emotionalStates[0] || 'neutral');
        return prediction[currentEmotionIndex] || 0.5;

      } catch (error) {
        logger.debug('Emotional alignment prediction failed, using fallback');
      }
    }

    // Fallback: simple preference matching
    const contentType = content.type;
    const userPreferences = profile.preferences.contentTypes;
    return userPreferences.includes(contentType) ? 0.8 : 0.4;
  }

  private calculateBehavioralMatch(content: any, profile: UserProfile): number {
    const contentType = content.type;
    const engagement = profile.behavioralPatterns.contentEngagement[contentType] || 0.5;

    // Factor in session timing
    const currentHour = new Date().getHours();
    const preferredTimes = profile.behavioralPatterns.preferredTimes;
    const timeMatch = preferredTimes.includes(currentHour) ? 1.0 : 0.7;

    return (engagement + timeMatch) / 2;
  }

  private calculateContextualFit(content: any, context: PersonalizationContext): number {
    let score = 0.5;

    // Time of day fit
    const hour = context.environmentalFactors.timeOfDay;
    if (hour >= 6 && hour <= 10) score += 0.1; // Morning - educational content
    else if (hour >= 18 && hour <= 22) score += 0.1; // Evening - reflective content

    // Session depth fit
    const sessionDepth = context.currentSession.interactions / 10; // Normalize
    if (content.features.complexity === 'simple' && sessionDepth < 0.3) score += 0.2;
    if (content.features.complexity === 'complex' && sessionDepth > 0.7) score += 0.2;

    // Network quality fit
    if (context.environmentalFactors.networkQuality === 'slow' && content.features.media === 'text') {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private async calculateCollaborativeFilter(content: any, profile: UserProfile): Promise<number> {
    // Use federated content preference model
    if (profile.personalizationModels.contentPreference) {
      try {
        const features = this.extractContentFeatures(content);
        const prediction = await this.federatedLearning.predictWithFederatedModel(
          'content-preference',
          features
        );

        // Return highest preference score
        return Math.max(...prediction);
      } catch (error) {
        logger.debug('Collaborative filtering prediction failed, using fallback');
      }
    }

    // Fallback: random but consistent score
    return 0.5 + (this.simpleHash(content.id + profile.userId) % 40) / 100; // 0.5-0.9 range
  }

  private extractEmotionalFeatures(content: any, context: PersonalizationContext): number[] {
    // Extract features for emotional response model
    return [
      content.features.sentiment || 0.5,
      content.features.emotional_intensity || 0.5,
      context.currentSession.interactions / 100, // Normalize
      context.recentHistory.last7Days.emotionalVariability,
      this.emotionToIndex(context.currentSession.emotionalStates[0] || 'neutral') / 10
    ];
  }

  private extractContentFeatures(content: any): number[] {
    // Extract features for content preference model
    const contentTypeIndex = this.contentTypeToIndex(content.type);
    return [
      contentTypeIndex / 10, // Normalize
      content.features.engagement || 0.5,
      content.features.complexity === 'simple' ? 0 : content.features.complexity === 'complex' ? 1 : 0.5,
      content.features.length || 0.5,
      content.features.interactive ? 1 : 0
    ];
  }

  private emotionToIndex(emotion: string): number {
    const emotions = ['joy', 'sadness', 'anger', 'fear', 'anxiety', 'calm', 'frustration', 'hope', 'overwhelm', 'neutral'];
    return emotions.indexOf(emotion) !== -1 ? emotions.indexOf(emotion) : 9; // Default to neutral
  }

  private contentTypeToIndex(type: string): number {
    const types = ['educational', 'supportive', 'interactive', 'reflective', 'practical', 'social'];
    return types.indexOf(type) !== -1 ? types.indexOf(type) : 0;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private generateRecommendationReasoning(factors: any): string {
    const reasons = [];

    if (factors.emotionalAlignment > 0.7) {
      reasons.push('matches your current emotional state');
    }
    if (factors.behavioralMatch > 0.7) {
      reasons.push('aligns with your usage patterns');
    }
    if (factors.contextualFit > 0.7) {
      reasons.push('fits your current context and timing');
    }
    if (factors.collaborativeFilter > 0.7) {
      reasons.push('popular among similar users');
    }

    return reasons.length > 0
      ? `Recommended because it ${reasons.join(', and ')}.`
      : 'Recommended based on general preferences.';
  }

  async generateInteractionSuggestions(
    userId: string,
    context: PersonalizationContext
  ): Promise<InteractionSuggestion[]> {
    try {
      const profile = await this.getUserProfile(userId);
      const suggestions: InteractionSuggestion[] = [];

      // Analyze current session state
      const sessionDepth = context.currentSession.interactions;
      const emotionalState = context.currentSession.emotionalStates.slice(-1)[0] || 'neutral';

      // Generate contextual suggestions
      if (sessionDepth > 20 && emotionalState === 'anxious') {
        suggestions.push({
          type: 'break',
          title: 'Take a Mindful Break',
          description: 'Consider a short breathing exercise to recenter yourself.',
          timing: 'immediate',
          emotionalContext: ['anxiety', 'overwhelm'],
          expectedOutcome: 'Reduced stress and improved focus',
          confidence: 0.8
        });
      }

      if (sessionDepth < 5 && emotionalState === 'calm') {
        suggestions.push({
          type: 'content',
          title: 'Explore New Content',
          description: 'You seem ready for some new learning material.',
          timing: 'soon',
          emotionalContext: ['calm', 'focused'],
          expectedOutcome: 'Continued engagement and learning',
          confidence: 0.7
        });
      }

      // Add personalized suggestions based on profile
      if (profile.behavioralPatterns.interactionDepth < 0.3) {
        suggestions.push({
          type: 'feature',
          title: 'Try Interactive Features',
          description: 'Explore our interactive tools for deeper engagement.',
          timing: 'later',
          emotionalContext: ['curious', 'engaged'],
          expectedOutcome: 'Increased interaction depth',
          confidence: 0.6
        });
      }

      return suggestions.slice(0, 3); // Limit to top 3 suggestions

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to generate interaction suggestions');

      return [];
    }
  }

  async updateUserModel(userId: string, modelType: string, gradients: Record<string, number[]>, sampleCount: number): Promise<void> {
    try {
      const model = await this.federatedLearning.getPersonalizedModel(userId, modelType);
      if (!model) {
        throw new Error(`Model ${modelType} not found for user ${userId}`);
      }

      await this.federatedLearning.submitLocalUpdate({
        userId,
        modelVersion: model.version,
        gradients,
        sampleCount,
        timestamp: new Date(),
        privacyNoise: 0 // Will be added by federated learning service
      });

      logger.debug({
        userId,
        modelType,
        sampleCount
      }, 'User model updated with federated learning');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        modelType
      }, 'Failed to update user model');
    }
  }

  getPersonalizationStats(): {
    totalUsers: number;
    activeModels: number;
    averageConfidence: number;
    recommendationCacheSize: number;
  } {
    const profiles = Array.from(this.userProfiles.values());
    const totalUsers = profiles.length;
    const averageConfidence = totalUsers > 0
      ? profiles.reduce((sum, p) => sum + p.confidence, 0) / totalUsers
      : 0;

    return {
      totalUsers,
      activeModels: this.federatedLearning.getModelStats() ? Object.keys(this.federatedLearning.getModelStats()).length : 0,
      averageConfidence,
      recommendationCacheSize: this.recommendationCache.size
    };
  }
}