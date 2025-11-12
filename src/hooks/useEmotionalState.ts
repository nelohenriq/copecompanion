import { useState, useEffect, useCallback } from 'react';
import { EmotionDetectionService, EmotionState, EmotionContext } from '@/services/emotion/EmotionDetectionService';
import { EmotionalUXService, EmotionalUXPreferences } from '@/services/ux/EmotionalUXService';
import { logger } from '@/lib/logger';

interface UseEmotionalStateOptions {
  userId: string;
  enabled?: boolean;
  autoDetect?: boolean;
  throttleMs?: number;
}

interface UseEmotionalStateReturn {
  // Current state
  emotion: EmotionState | null;
  adaptation: any; // EmotionalUXAdaptation
  isLoading: boolean;
  error: string | null;

  // Actions
  detectEmotion: (context: EmotionContext) => Promise<void>;
  updatePreferences: (updates: Partial<EmotionalUXPreferences>) => Promise<void>;
  emergencyStop: () => Promise<void>;

  // Utilities
  getEmotionHistory: (limit?: number) => EmotionState[];
  isHighIntensity: boolean;
  isNegativeEmotion: boolean;
  needsCalming: boolean;
}

export function useEmotionalState(options: UseEmotionalStateOptions): UseEmotionalStateReturn {
  const { userId, enabled = true, autoDetect = true, throttleMs = 5000 } = options;

  // Services
  const [emotionService] = useState(() => new EmotionDetectionService());
  const [uxService] = useState(() => new EmotionalUXService());

  // State
  const [emotion, setEmotion] = useState<EmotionState | null>(null);
  const [adaptation, setAdaptation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDetection, setLastDetection] = useState<number>(0);

  // Detect emotion with throttling
  const detectEmotion = useCallback(async (context: EmotionContext) => {
    if (!enabled) return;

    const now = Date.now();
    if (now - lastDetection < throttleMs) {
      return; // Throttle detections
    }

    try {
      setIsLoading(true);
      setError(null);

      // Detect emotion
      const detectedEmotion = await emotionService.detectEmotion(context);
      setEmotion(detectedEmotion);
      setLastDetection(now);

      // Get adaptation
      const emotionalAdaptation = await uxService.getEmotionalUXAdaptation(userId, context);
      setAdaptation(emotionalAdaptation);

      logger.debug({
        userId,
        emotion: detectedEmotion.primaryEmotion,
        intensity: detectedEmotion.intensity,
        confidence: detectedEmotion.confidence
      }, 'Emotion detected via hook');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to detect emotion via hook');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId, throttleMs, lastDetection, emotionService, uxService]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<EmotionalUXPreferences>) => {
    try {
      await uxService.updateUserPreferences(userId, updates);
      logger.info({
        userId,
        updates: Object.keys(updates)
      }, 'Emotional UX preferences updated via hook');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to update preferences via hook');
    }
  }, [userId, uxService]);

  // Emergency stop
  const emergencyStop = useCallback(async () => {
    try {
      await uxService.emergencyStop(userId);
      setEmotion(null);
      setAdaptation(null);
      logger.warn({ userId }, 'Emergency stop activated via hook');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to execute emergency stop via hook');
    }
  }, [userId, uxService]);

  // Get emotion history
  const getEmotionHistory = useCallback((limit: number = 10) => {
    return emotionService.getEmotionHistory(userId, limit);
  }, [userId, emotionService]);

  // Auto-detection on mount and user interactions
  useEffect(() => {
    if (!enabled || !autoDetect) return;

    let throttleTimer: NodeJS.Timeout;

    const handleUserInteraction = (event: Event) => {
      if (throttleTimer) clearTimeout(throttleTimer);

      throttleTimer = setTimeout(() => {
        const context: EmotionContext = {
          userId,
          sessionId: 'current-session',
          interactionType: 'navigation',
          metadata: {
            eventType: event.type,
            target: (event.target as HTMLElement)?.tagName,
            timestamp: Date.now()
          }
        };

        detectEmotion(context).catch(err => {
          // Silently handle auto-detection errors
          logger.debug({
            error: err instanceof Error ? err.message : 'Unknown error',
            userId
          }, 'Auto emotion detection failed');
        });
      }, 2000); // Shorter throttle for auto-detection
    };

    // Listen for user interactions
    const events = ['click', 'scroll', 'keydown', 'focus'];
    events.forEach(eventType => {
      document.addEventListener(eventType, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, handleUserInteraction);
      });
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [enabled, autoDetect, userId, detectEmotion]);

  // Computed values
  const isHighIntensity = emotion ? emotion.intensity > 0.7 : false;
  const isNegativeEmotion = emotion ? ['anxiety', 'fear', 'sadness', 'anger', 'frustration', 'overwhelm'].includes(emotion.primaryEmotion) : false;
  const needsCalming = emotion ? (isNegativeEmotion && isHighIntensity) : false;

  return {
    emotion,
    adaptation,
    isLoading,
    error,
    detectEmotion,
    updatePreferences,
    emergencyStop,
    getEmotionHistory,
    isHighIntensity,
    isNegativeEmotion,
    needsCalming
  };
}

// Specialized hook for content-based emotion detection
export function useContentEmotion(content: string, options: UseEmotionalStateOptions) {
  const hook = useEmotionalState({ ...options, autoDetect: false });

  useEffect(() => {
    if (content && content.length > 10) {
      const context: EmotionContext = {
        userId: options.userId,
        sessionId: 'content-session',
        interactionType: 'content_view',
        content,
        metadata: { contentLength: content.length }
      };

      hook.detectEmotion(context).catch(err => {
        logger.debug({
          error: err instanceof Error ? err.message : 'Unknown error',
          userId: options.userId
        }, 'Content emotion detection failed');
      });
    }
  }, [content, options.userId, hook]);

  return hook;
}

// Hook for form interaction emotion detection
export function useFormEmotion(options: UseEmotionalStateOptions) {
  const hook = useEmotionalState({ ...options, autoDetect: false });

  const detectFormEmotion = useCallback((formData: Record<string, any>, formType: string) => {
    const context: EmotionContext = {
      userId: options.userId,
      sessionId: 'form-session',
      interactionType: 'form_input',
      metadata: {
        formType,
        fieldCount: Object.keys(formData).length,
        hasErrors: Object.values(formData).some(value =>
          typeof value === 'string' && value.includes('error')
        )
      }
    };

    return hook.detectEmotion(context);
  }, [options.userId, hook]);

  return {
    ...hook,
    detectFormEmotion
  };
}

// Hook for real-time emotion monitoring
export function useEmotionMonitor(options: UseEmotionalStateOptions) {
  const hook = useEmotionalState(options);

  // Monitor for concerning emotion patterns
  useEffect(() => {
    if (!hook.emotion || !hook.isHighIntensity) return;

    const concerningEmotions = ['anxiety', 'fear', 'overwhelm'];
    if (concerningEmotions.includes(hook.emotion.primaryEmotion)) {
      logger.warn({
        userId: options.userId,
        emotion: hook.emotion.primaryEmotion,
        intensity: hook.emotion.intensity
      }, 'Concerning emotion pattern detected');

      // Could trigger additional support measures here
    }
  }, [hook.emotion, hook.isHighIntensity, options.userId]);

  return hook;
}