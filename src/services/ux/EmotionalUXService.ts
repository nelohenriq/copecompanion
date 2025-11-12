import { EmotionDetectionService, EmotionState, EmotionalUXAdaptation, EmotionContext } from '@/services/emotion/EmotionDetectionService';
import { logger } from '@/lib/logger';

export interface EmotionalUXPreferences {
  userId: string;
  enabled: boolean;
  triggerThreshold: number; // 0-1, minimum emotion intensity to trigger adaptation
  adaptationSpeed: 'slow' | 'normal' | 'fast';
  calmingColorsOnly: boolean;
  disableAnimations: boolean;
  preferredTone: 'supportive' | 'neutral' | 'encouraging' | 'auto';
  accessibilityMode: boolean;
  triggerBlacklist: string[]; // Emotion types to ignore
  lastUpdated: Date;
}

export interface UXTransition {
  from: EmotionalUXAdaptation;
  to: EmotionalUXAdaptation;
  duration: number; // milliseconds
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  startTime: Date;
}

export class EmotionalUXService {
  private emotionService: EmotionDetectionService;
  private userPreferences: Map<string, EmotionalUXPreferences> = new Map();
  private activeTransitions: Map<string, UXTransition> = new Map();
  private adaptationHistory: Map<string, EmotionalUXAdaptation[]> = new Map();
  private defaultPreferences: EmotionalUXPreferences;

  constructor() {
    this.emotionService = new EmotionDetectionService();
    this.defaultPreferences = {
      userId: '',
      enabled: true,
      triggerThreshold: 0.4,
      adaptationSpeed: 'normal',
      calmingColorsOnly: false,
      disableAnimations: false,
      preferredTone: 'auto',
      accessibilityMode: false,
      triggerBlacklist: [],
      lastUpdated: new Date()
    };
  }

  async getEmotionalUXAdaptation(userId: string, context: EmotionContext): Promise<EmotionalUXAdaptation> {
    try {
      // Get user preferences
      const preferences = this.getUserPreferences(userId);

      if (!preferences.enabled) {
        return this.getNeutralAdaptation();
      }

      // Detect current emotion
      const emotion = await this.emotionService.detectEmotion(context);

      // Check if emotion meets trigger threshold
      if (emotion.intensity < preferences.triggerThreshold) {
        return this.getNeutralAdaptation();
      }

      // Check if emotion is blacklisted
      if (preferences.triggerBlacklist.includes(emotion.primaryEmotion)) {
        return this.getNeutralAdaptation();
      }

      // Get adaptation for emotion
      const adaptation = await this.emotionService.getEmotionalUXAdaptation(userId, emotion);

      // Apply user preferences
      const personalizedAdaptation = this.applyUserPreferences(adaptation, preferences);

      // Store in history
      this.storeAdaptationHistory(userId, personalizedAdaptation);

      logger.debug({
        userId,
        emotion: emotion.primaryEmotion,
        intensity: emotion.intensity,
        adaptationApplied: true
      }, 'Emotional UX adaptation generated');

      return personalizedAdaptation;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to get emotional UX adaptation');

      // Return neutral adaptation as fallback
      return this.getNeutralAdaptation();
    }
  }

  private getNeutralAdaptation(): EmotionalUXAdaptation {
    return {
      colorScheme: {
        primary: '#3b82f6',
        secondary: '#64748b',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1e293b',
        accent: '#10b981',
        calming: false
      },
      typography: {
        fontSize: 'medium',
        fontWeight: 'normal',
        lineHeight: 1.5,
        letterSpacing: 0
      },
      spacing: {
        padding: 'normal',
        margin: 'normal',
        density: 'comfortable'
      },
      interactions: {
        feedback: 'moderate',
        complexity: 'moderate',
        guidance: 'subtle'
      },
      animations: {
        speed: 'normal',
        intensity: 'moderate',
        enabled: true
      },
      content: {
        length: 'moderate',
        complexity: 'moderate',
        tone: 'neutral',
        pacing: 'normal'
      }
    };
  }

  private applyUserPreferences(
    adaptation: EmotionalUXAdaptation,
    preferences: EmotionalUXPreferences
  ): EmotionalUXAdaptation {
    const result = { ...adaptation };

    // Apply calming colors preference
    if (preferences.calmingColorsOnly && !adaptation.colorScheme.calming) {
      result.colorScheme = {
        ...adaptation.colorScheme,
        background: '#fef7f7',
        surface: '#fdf4f4',
        accent: '#84cc16',
        calming: true
      };
    }

    // Apply animation preferences
    if (preferences.disableAnimations) {
      result.animations.enabled = false;
    }

    // Apply speed preferences
    result.animations.speed = preferences.adaptationSpeed;

    // Apply tone preferences
    if (preferences.preferredTone !== 'auto') {
      result.content.tone = preferences.preferredTone;
    }

    // Apply accessibility preferences
    if (preferences.accessibilityMode) {
      result.typography.fontSize = 'large';
      result.spacing.density = 'spacious';
      result.interactions.complexity = 'simple';
      result.animations.intensity = 'subtle';
    }

    return result;
  }

  async createSmoothTransition(
    userId: string,
    fromAdaptation: EmotionalUXAdaptation,
    toAdaptation: EmotionalUXAdaptation
  ): Promise<UXTransition> {
    const preferences = this.getUserPreferences(userId);

    // Calculate transition duration based on preferences and adaptation complexity
    const baseDuration = this.calculateTransitionDuration(fromAdaptation, toAdaptation);
    const adjustedDuration = this.adjustDurationForPreferences(baseDuration, preferences);

    const transition: UXTransition = {
      from: fromAdaptation,
      to: toAdaptation,
      duration: adjustedDuration,
      easing: 'ease-in-out',
      startTime: new Date()
    };

    // Store active transition
    this.activeTransitions.set(userId, transition);

    // Auto-cleanup after transition completes
    setTimeout(() => {
      this.activeTransitions.delete(userId);
    }, adjustedDuration + 1000); // Add 1 second buffer

    logger.debug({
      userId,
      duration: adjustedDuration,
      easing: transition.easing
    }, 'Smooth UX transition created');

    return transition;
  }

  private calculateTransitionDuration(
    from: EmotionalUXAdaptation,
    to: EmotionalUXAdaptation
  ): number {
    // Calculate complexity based on differences
    let complexity = 0;

    // Color changes are most noticeable
    if (from.colorScheme.primary !== to.colorScheme.primary) complexity += 2;
    if (from.colorScheme.background !== to.colorScheme.background) complexity += 3;

    // Spacing changes
    if (from.spacing.density !== to.spacing.density) complexity += 1;

    // Typography changes
    if (from.typography.fontSize !== to.typography.fontSize) complexity += 2;

    // Animation changes
    if (from.animations.enabled !== to.animations.enabled) complexity += 1;

    // Base duration: 300ms, add 100ms per complexity point, max 1000ms
    return Math.min(300 + (complexity * 100), 1000);
  }

  private adjustDurationForPreferences(duration: number, preferences: EmotionalUXPreferences): number {
    const multipliers = {
      slow: 1.5,
      normal: 1.0,
      fast: 0.7
    };

    return Math.round(duration * multipliers[preferences.adaptationSpeed]);
  }

  getActiveTransition(userId: string): UXTransition | null {
    return this.activeTransitions.get(userId) || null;
  }

  getUserPreferences(userId: string): EmotionalUXPreferences {
    return this.userPreferences.get(userId) || { ...this.defaultPreferences, userId };
  }

  async updateUserPreferences(userId: string, updates: Partial<EmotionalUXPreferences>): Promise<EmotionalUXPreferences> {
    const current = this.getUserPreferences(userId);
    const updated = {
      ...current,
      ...updates,
      userId,
      lastUpdated: new Date()
    };

    this.userPreferences.set(userId, updated);

    // Persist to database (would be implemented)
    await this.persistUserPreferences(updated);

    logger.info({
      userId,
      updates: Object.keys(updates)
    }, 'User emotional UX preferences updated');

    return updated;
  }

  private async persistUserPreferences(preferences: EmotionalUXPreferences): Promise<void> {
    // TODO: Implement database persistence
    // This would save to a user preferences table
    logger.debug({ userId: preferences.userId }, 'Persisting user preferences');
  }

  private storeAdaptationHistory(userId: string, adaptation: EmotionalUXAdaptation): void {
    const history = this.adaptationHistory.get(userId) || [];
    history.push(adaptation);

    // Keep only last 20 adaptations
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    this.adaptationHistory.set(userId, history);
  }

  getAdaptationHistory(userId: string, limit: number = 10): EmotionalUXAdaptation[] {
    const history = this.adaptationHistory.get(userId) || [];
    return history.slice(-limit);
  }

  async generateEmotionalUXReport(userId: string, timeRange: { start: Date; end: Date }): Promise<{
    totalAdaptations: number;
    emotionDistribution: Record<string, number>;
    mostCommonTriggers: string[];
    effectiveness: {
      userSatisfaction: number;
      adaptationFrequency: number;
      preferenceChanges: number;
    };
  }> {
    try {
      const history = this.adaptationHistory.get(userId) || [];
      const emotions = await this.emotionService.getEmotionHistory(userId, 100);

      // Filter by time range
      const filteredHistory = history.filter(adaptation => {
        // This would need timestamp tracking in adaptations
        return true; // Placeholder
      });

      // Analyze emotion distribution
      const emotionCounts: Record<string, number> = {};
      emotions.forEach(emotion => {
        emotionCounts[emotion.primaryEmotion] = (emotionCounts[emotion.primaryEmotion] || 0) + 1;
      });

      // Calculate most common triggers
      const triggerCounts = Object.entries(emotionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([emotion]) => emotion);

      return {
        totalAdaptations: filteredHistory.length,
        emotionDistribution: emotionCounts,
        mostCommonTriggers: triggerCounts,
        effectiveness: {
          userSatisfaction: 0.85, // Would be calculated from user feedback
          adaptationFrequency: emotions.length / 30, // Adaptations per day
          preferenceChanges: 0 // Would track preference updates
        }
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to generate emotional UX report');

      return {
        totalAdaptations: 0,
        emotionDistribution: {},
        mostCommonTriggers: [],
        effectiveness: {
          userSatisfaction: 0,
          adaptationFrequency: 0,
          preferenceChanges: 0
        }
      };
    }
  }

  // Utility methods for CSS variable generation
  generateCSSVariables(adaptation: EmotionalUXAdaptation): Record<string, string> {
    return {
      '--color-primary': adaptation.colorScheme.primary,
      '--color-secondary': adaptation.colorScheme.secondary,
      '--color-background': adaptation.colorScheme.background,
      '--color-surface': adaptation.colorScheme.surface,
      '--color-text': adaptation.colorScheme.text,
      '--color-accent': adaptation.colorScheme.accent,
      '--typography-font-size': this.mapFontSize(adaptation.typography.fontSize),
      '--typography-font-weight': this.mapFontWeight(adaptation.typography.fontWeight),
      '--typography-line-height': adaptation.typography.lineHeight.toString(),
      '--typography-letter-spacing': adaptation.typography.letterSpacing.toString() + 'em',
      '--spacing-padding': this.mapSpacing(adaptation.spacing.padding),
      '--spacing-margin': this.mapSpacing(adaptation.spacing.margin),
      '--spacing-density': this.mapDensity(adaptation.spacing.density),
      '--animation-duration': this.mapAnimationSpeed(adaptation.animations.speed),
      '--animation-enabled': adaptation.animations.enabled ? '1' : '0'
    };
  }

  private mapFontSize(size: string): string {
    const sizes = { small: '14px', medium: '16px', large: '18px' };
    return sizes[size as keyof typeof sizes] || '16px';
  }

  private mapFontWeight(weight: string): string {
    const weights = { light: '300', normal: '400', bold: '600' };
    return weights[weight as keyof typeof weights] || '400';
  }

  private mapSpacing(spacing: string): string {
    const spacings = { tight: '8px', normal: '16px', loose: '24px' };
    return spacings[spacing as keyof typeof spacings] || '16px';
  }

  private mapDensity(density: string): string {
    const densities = { compact: '0.8', comfortable: '1.0', spacious: '1.2' };
    return densities[density as keyof typeof densities] || '1.0';
  }

  private mapAnimationSpeed(speed: string): string {
    const speeds = { slow: '0.5s', normal: '0.3s', fast: '0.15s' };
    return speeds[speed as keyof typeof speeds] || '0.3s';
  }

  // Emergency stop for emotional UX
  async emergencyStop(userId: string): Promise<void> {
    // Clear all active transitions
    this.activeTransitions.delete(userId);

    // Reset to neutral adaptation
    const neutral = this.getNeutralAdaptation();
    this.storeAdaptationHistory(userId, neutral);

    // Disable emotional UX temporarily
    await this.updateUserPreferences(userId, { enabled: false });

    logger.warn({ userId }, 'Emergency stop activated for emotional UX');
  }

  // Health check for the service
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      activeUsers: number;
      activeTransitions: number;
      averageResponseTime: number;
      errorRate: number;
    };
  }> {
    try {
      const activeUsers = this.userPreferences.size;
      const activeTransitions = this.activeTransitions.size;

      return {
        status: 'healthy',
        metrics: {
          activeUsers,
          activeTransitions,
          averageResponseTime: 150, // Mock value
          errorRate: 0.01 // Mock value
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: {
          activeUsers: 0,
          activeTransitions: 0,
          averageResponseTime: 0,
          errorRate: 1.0
        }
      };
    }
  }
}