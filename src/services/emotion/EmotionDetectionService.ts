import { logger } from '@/lib/logger';

export interface EmotionState {
  primaryEmotion: EmotionType;
  intensity: number; // 0-1
  confidence: number; // 0-1
  secondaryEmotions: Array<{ emotion: EmotionType; intensity: number }>;
  detectedAt: Date;
  source: 'text' | 'voice' | 'facial' | 'behavioral' | 'combined';
  context: EmotionContext;
}

export interface EmotionContext {
  userId: string;
  sessionId: string;
  interactionType: 'chat' | 'content_view' | 'form_input' | 'navigation' | 'idle';
  content?: string;
  metadata: Record<string, any>;
}

export type EmotionType =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'anxiety'
  | 'calm'
  | 'frustration'
  | 'hope'
  | 'overwhelm'
  | 'neutral';

export interface EmotionalUXAdaptation {
  colorScheme: ColorScheme;
  typography: TypographySettings;
  spacing: SpacingSettings;
  interactions: InteractionSettings;
  animations: AnimationSettings;
  content: ContentAdaptation;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  calming: boolean;
}

export interface TypographySettings {
  fontSize: 'small' | 'medium' | 'large';
  fontWeight: 'light' | 'normal' | 'bold';
  lineHeight: number;
  letterSpacing: number;
}

export interface SpacingSettings {
  padding: 'tight' | 'normal' | 'loose';
  margin: 'tight' | 'normal' | 'loose';
  density: 'compact' | 'comfortable' | 'spacious';
}

export interface InteractionSettings {
  feedback: 'minimal' | 'moderate' | 'extensive';
  complexity: 'simple' | 'moderate' | 'advanced';
  guidance: 'none' | 'subtle' | 'prominent';
}

export interface AnimationSettings {
  speed: 'slow' | 'normal' | 'fast';
  intensity: 'subtle' | 'moderate' | 'pronounced';
  enabled: boolean;
}

export interface ContentAdaptation {
  length: 'brief' | 'moderate' | 'detailed';
  complexity: 'simple' | 'moderate' | 'complex';
  tone: 'supportive' | 'neutral' | 'encouraging';
  pacing: 'slow' | 'normal' | 'fast';
}

export class EmotionDetectionService {
  private emotionHistory: Map<string, EmotionState[]> = new Map();
  private adaptationCache: Map<string, EmotionalUXAdaptation> = new Map();

  constructor() {
    this.initializeEmotionDetection();
  }

  private initializeEmotionDetection() {
    // Initialize emotion detection models and monitoring
    logger.info('Emotion detection service initialized');
  }

  async detectEmotion(context: EmotionContext): Promise<EmotionState> {
    try {
      // Multi-modal emotion detection
      const textEmotion = context.content ? await this.detectFromText(context.content) : null;
      const behavioralEmotion = await this.detectFromBehavior(context);
      const sessionEmotion = await this.detectFromSessionHistory(context.userId);

      // Combine detections with confidence weighting
      const combinedEmotion = this.combineEmotionDetections({
        text: textEmotion,
        behavioral: behavioralEmotion,
        session: sessionEmotion
      });

      // Store in history
      this.storeEmotionState(context.userId, combinedEmotion);

      logger.debug({
        userId: context.userId,
        primaryEmotion: combinedEmotion.primaryEmotion,
        intensity: combinedEmotion.intensity,
        confidence: combinedEmotion.confidence
      }, 'Emotion detected');

      return combinedEmotion;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId
      }, 'Failed to detect emotion');

      // Return neutral emotion as fallback
      return {
        primaryEmotion: 'neutral',
        intensity: 0.5,
        confidence: 0.5,
        secondaryEmotions: [],
        detectedAt: new Date(),
        source: 'combined',
        context
      };
    }
  }

  private async detectFromText(text: string): Promise<EmotionState | null> {
    try {
      // Simple sentiment analysis (would be replaced with ML model)
      const lowerText = text.toLowerCase();

      // Basic emotion detection patterns
      const emotionPatterns = {
        joy: /\b(happy|excited|great|wonderful|amazing|love|awesome)\b/,
        sadness: /\b(sad|depressed|unhappy|down|blue|cry|crying|heartbroken)\b/,
        anger: /\b(angry|mad|furious|frustrated|annoyed|hate|rage)\b/,
        fear: /\b(scared|afraid|fear|anxious|nervous|worried|terrified)\b/,
        anxiety: /\b(anxious|overwhelmed|stressed|panic|nervous|worry)\b/,
        calm: /\b(calm|peaceful|relaxed|serene|tranquil|content)\b/,
        frustration: /\b(frustrated|stuck|confused|lost|overwhelmed|difficult)\b/,
        hope: /\b(hope|optimistic|better|improving|progress|future)\b/,
        overwhelm: /\b(overwhelmed|too much|can't handle|swamped|drowning)\b/
      };

      let detectedEmotions: Array<{ emotion: EmotionType; score: number }> = [];

      for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
        const matches = text.match(pattern);
        if (matches) {
          const score = Math.min(matches.length * 0.3, 1.0); // Cap at 1.0
          detectedEmotions.push({ emotion: emotion as EmotionType, score });
        }
      }

      if (detectedEmotions.length === 0) {
        return null;
      }

      // Sort by score and take top emotion
      detectedEmotions.sort((a, b) => b.score - a.score);
      const primary = detectedEmotions[0];
      const secondary = detectedEmotions.slice(1, 3); // Top 2 secondary emotions

      return {
        primaryEmotion: primary.emotion,
        intensity: primary.score,
        confidence: Math.min(primary.score + 0.2, 1.0), // Add some confidence boost
        secondaryEmotions: secondary.map(e => ({ emotion: e.emotion, intensity: e.score })),
        detectedAt: new Date(),
        source: 'text',
        context: {} as EmotionContext // Will be set by caller
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to detect emotion from text');
      return null;
    }
  }

  private async detectFromBehavior(context: EmotionContext): Promise<EmotionState | null> {
    try {
      // Behavioral emotion detection based on interaction patterns
      const recentInteractions = await this.getRecentInteractions(context.userId);

      if (recentInteractions.length < 3) {
        return null; // Need minimum interactions for behavioral analysis
      }

      // Analyze interaction patterns
      const interactionRate = recentInteractions.length / 5; // Interactions per minute
      const avgSessionLength = recentInteractions.reduce((sum, i) => sum + i.duration, 0) / recentInteractions.length;
      const errorRate = recentInteractions.filter(i => i.hadErrors).length / recentInteractions.length;

      // Behavioral emotion indicators
      let emotion: EmotionType = 'neutral';
      let intensity = 0.5;
      let confidence = 0.6;

      if (interactionRate > 2.0) {
        // High interaction rate might indicate anxiety or urgency
        emotion = 'anxiety';
        intensity = Math.min(interactionRate / 4.0, 1.0);
      } else if (interactionRate < 0.2) {
        // Low interaction rate might indicate overwhelm or disengagement
        emotion = 'overwhelm';
        intensity = Math.max((0.5 - interactionRate) * 2, 0.3);
      } else if (errorRate > 0.3) {
        // High error rate might indicate frustration
        emotion = 'frustration';
        intensity = errorRate;
      } else if (avgSessionLength > 300) { // 5 minutes
        // Long sessions might indicate calm, focused engagement
        emotion = 'calm';
        intensity = Math.min(avgSessionLength / 600, 1.0); // Scale to 10 minutes
      }

      return {
        primaryEmotion: emotion,
        intensity,
        confidence,
        secondaryEmotions: [],
        detectedAt: new Date(),
        source: 'behavioral',
        context
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId
      }, 'Failed to detect emotion from behavior');
      return null;
    }
  }

  private async detectFromSessionHistory(userId: string): Promise<EmotionState | null> {
    try {
      const history = this.emotionHistory.get(userId) || [];

      if (history.length < 2) {
        return null; // Need history for trend analysis
      }

      // Analyze recent emotional trends
      const recentHistory = history.slice(-5); // Last 5 emotion detections
      const avgIntensity = recentHistory.reduce((sum, e) => sum + e.intensity, 0) / recentHistory.length;

      // Check for emotional stability or trends
      const emotions = recentHistory.map(e => e.primaryEmotion);
      const mostCommonEmotion = this.getMostCommonEmotion(emotions);

      // If emotions are stable, maintain current emotional state
      const stability = this.calculateEmotionalStability(recentHistory);

      return {
        primaryEmotion: mostCommonEmotion,
        intensity: avgIntensity,
        confidence: stability, // Higher stability = higher confidence
        secondaryEmotions: [],
        detectedAt: new Date(),
        source: 'behavioral',
        context: { userId, sessionId: '', interactionType: 'idle', metadata: {} } // Minimal context
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: userId
      }, 'Failed to detect emotion from session history');
      return null;
    }
  }

  private combineEmotionDetections(detections: {
    text?: EmotionState | null;
    behavioral?: EmotionState | null;
    session?: EmotionState | null;
  }): EmotionState {
    const validDetections = Object.values(detections).filter(d => d !== null) as EmotionState[];

    if (validDetections.length === 0) {
      // Return neutral if no detections
      return {
        primaryEmotion: 'neutral',
        intensity: 0.5,
        confidence: 0.3,
        secondaryEmotions: [],
        detectedAt: new Date(),
        source: 'combined',
        context: { userId: '', sessionId: '', interactionType: 'idle', metadata: {} }
      };
    }

    if (validDetections.length === 1) {
      return { ...validDetections[0], source: 'combined' };
    }

    // Weight detections by confidence and recency
    const weightedEmotions = validDetections.map(detection => ({
      emotion: detection.primaryEmotion,
      intensity: detection.intensity,
      weight: detection.confidence * this.getRecencyWeight(detection.detectedAt)
    }));

    // Combine emotions (simplified - take highest weighted emotion)
    const bestDetection = weightedEmotions.reduce((best, current) =>
      current.weight > best.weight ? current : best
    );

    // Calculate combined confidence
    const avgConfidence = validDetections.reduce((sum, d) => sum + d.confidence, 0) / validDetections.length;

    return {
      primaryEmotion: bestDetection.emotion,
      intensity: bestDetection.intensity,
      confidence: Math.min(avgConfidence + 0.1, 1.0), // Slight boost for combined detection
      secondaryEmotions: [],
      detectedAt: new Date(),
      source: 'combined',
      context: validDetections[0].context // Use first context
    };
  }

  private getRecencyWeight(timestamp: Date): number {
    const minutesAgo = (Date.now() - timestamp.getTime()) / (1000 * 60);
    // Exponential decay: more recent = higher weight
    return Math.exp(-minutesAgo / 30); // Half-life of 30 minutes
  }

  private getMostCommonEmotion(emotions: EmotionType[]): EmotionType {
    const counts = emotions.reduce((acc, emotion) => {
      acc[emotion] = (acc[emotion] || 0) + 1;
      return acc;
    }, {} as Record<EmotionType, number>);

    return Object.entries(counts).reduce((a, b) => counts[a[0] as EmotionType] > counts[b[0] as EmotionType] ? a : b)[0] as EmotionType;
  }

  private calculateEmotionalStability(history: EmotionState[]): number {
    if (history.length < 2) return 0.5;

    // Calculate variance in intensity
    const intensities = history.map(e => e.intensity);
    const mean = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    const variance = intensities.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intensities.length;

    // Lower variance = higher stability
    return Math.max(0, 1 - variance);
  }

  private storeEmotionState(userId: string, emotion: EmotionState): void {
    const history = this.emotionHistory.get(userId) || [];
    history.push(emotion);

    // Keep only last 50 emotion states
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    this.emotionHistory.set(userId, history);
  }

  private async getRecentInteractions(userId: string): Promise<Array<{ duration: number; hadErrors: boolean }>> {
    // This would query actual interaction data
    // For now, return mock data
    return [
      { duration: 120, hadErrors: false },
      { duration: 90, hadErrors: true },
      { duration: 200, hadErrors: false }
    ];
  }

  async getEmotionalUXAdaptation(userId: string, emotion: EmotionState): Promise<EmotionalUXAdaptation> {
    // Check cache first
    const cacheKey = `${userId}-${emotion.primaryEmotion}-${Math.floor(emotion.intensity * 10)}`;
    const cached = this.adaptationCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Generate adaptation based on emotion
    const adaptation = this.generateUXAdaptation(emotion);

    // Cache for 5 minutes
    this.adaptationCache.set(cacheKey, adaptation);
    setTimeout(() => this.adaptationCache.delete(cacheKey), 5 * 60 * 1000);

    return adaptation;
  }

  private generateUXAdaptation(emotion: EmotionState): EmotionalUXAdaptation {
    const { primaryEmotion, intensity } = emotion;

    // Base adaptation settings
    const adaptation: EmotionalUXAdaptation = {
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

    // Adapt based on emotion
    switch (primaryEmotion) {
      case 'anxiety':
      case 'fear':
        adaptation.colorScheme = {
          ...adaptation.colorScheme,
          background: '#fef7f7',
          surface: '#fdf4f4',
          accent: '#84cc16',
          calming: true
        };
        adaptation.spacing.density = 'spacious';
        adaptation.interactions.complexity = 'simple';
        adaptation.interactions.guidance = 'prominent';
        adaptation.animations.speed = 'slow';
        adaptation.content.length = 'brief';
        adaptation.content.tone = 'supportive';
        break;

      case 'sadness':
        adaptation.colorScheme = {
          ...adaptation.colorScheme,
          background: '#f0f9ff',
          surface: '#e0f2fe',
          accent: '#06b6d4',
          calming: true
        };
        adaptation.spacing.density = 'comfortable';
        adaptation.animations.intensity = 'subtle';
        adaptation.content.tone = 'encouraging';
        adaptation.content.pacing = 'slow';
        break;

      case 'anger':
      case 'frustration':
        adaptation.colorScheme = {
          ...adaptation.colorScheme,
          background: '#fefce8',
          surface: '#fef3c7',
          accent: '#f59e0b',
          calming: true
        };
        adaptation.spacing.density = 'spacious';
        adaptation.interactions.feedback = 'extensive';
        adaptation.animations.enabled = intensity > 0.7 ? false : true;
        adaptation.content.length = 'brief';
        adaptation.content.complexity = 'simple';
        break;

      case 'overwhelm':
        adaptation.colorScheme = {
          ...adaptation.colorScheme,
          background: '#f8fafc',
          surface: '#f1f5f9',
          calming: true
        };
        adaptation.spacing.density = 'spacious';
        adaptation.interactions.complexity = 'simple';
        adaptation.content.length = 'brief';
        adaptation.content.complexity = 'simple';
        adaptation.animations.intensity = 'subtle';
        break;

      case 'joy':
      case 'hope':
        adaptation.colorScheme = {
          ...adaptation.colorScheme,
          background: '#f0fdf4',
          surface: '#dcfce7',
          accent: '#22c55e',
          calming: false
        };
        adaptation.animations.intensity = 'moderate';
        adaptation.content.tone = 'encouraging';
        break;

      case 'calm':
        adaptation.colorScheme = {
          ...adaptation.colorScheme,
          background: '#f0f9ff',
          surface: '#e0f2fe',
          accent: '#0ea5e9',
          calming: true
        };
        adaptation.animations.speed = 'slow';
        adaptation.animations.intensity = 'subtle';
        adaptation.content.pacing = 'slow';
        break;
    }

    // Adjust intensity based on emotion strength
    if (intensity > 0.8) {
      adaptation.spacing.density = 'spacious';
      adaptation.interactions.complexity = 'simple';
      adaptation.content.length = 'brief';
    }

    return adaptation;
  }

  getEmotionHistory(userId: string, limit: number = 10): EmotionState[] {
    const history = this.emotionHistory.get(userId) || [];
    return history.slice(-limit);
  }

  clearEmotionHistory(userId: string): void {
    this.emotionHistory.delete(userId);
    logger.info({ userId }, 'Emotion history cleared');
  }
}