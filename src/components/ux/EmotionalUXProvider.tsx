'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { EmotionalUXService, EmotionalUXPreferences, UXTransition } from '@/services/ux/EmotionalUXService';
import { EmotionDetectionService, EmotionState, EmotionalUXAdaptation, EmotionContext } from '@/services/emotion/EmotionDetectionService';
import { logger } from '@/lib/logger';

interface EmotionalUXContextValue {
  // Current state
  currentEmotion: EmotionState | null;
  currentAdaptation: EmotionalUXAdaptation;
  currentTransition: UXTransition | null;

  // User preferences
  preferences: EmotionalUXPreferences;
  updatePreferences: (updates: Partial<EmotionalUXPreferences>) => Promise<void>;

  // Actions
  detectEmotion: (context: EmotionContext) => Promise<void>;
  emergencyStop: () => Promise<void>;

  // Utilities
  generateCSSVariables: () => Record<string, string>;
  isTransitioning: boolean;
}

const EmotionalUXContext = createContext<EmotionalUXContextValue | null>(null);

interface EmotionalUXProviderProps {
  children: ReactNode;
  userId: string;
  enabled?: boolean;
}

export function EmotionalUXProvider({
  children,
  userId,
  enabled = true
}: EmotionalUXProviderProps) {
  // Services
  const [uxService] = useState(() => new EmotionalUXService());
  const [emotionService] = useState(() => new EmotionDetectionService());

  // State
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState | null>(null);
  const [currentAdaptation, setCurrentAdaptation] = useState<EmotionalUXAdaptation>(
    uxService['getNeutralAdaptation']() // Access private method
  );
  const [currentTransition, setCurrentTransition] = useState<UXTransition | null>(null);
  const [preferences, setPreferences] = useState<EmotionalUXPreferences>(
    uxService.getUserPreferences(userId)
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const userPrefs = uxService.getUserPreferences(userId);
        setPreferences(userPrefs);
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : 'Unknown error',
          userId
        }, 'Failed to load emotional UX preferences');
      }
    };

    if (enabled && userId) {
      loadPreferences();
    }
  }, [userId, enabled, uxService]);

  // Emotion detection
  const detectEmotion = useCallback(async (context: EmotionContext) => {
    if (!enabled || !preferences.enabled) {
      return;
    }

    try {
      setIsTransitioning(true);

      // Detect emotion
      const emotion = await emotionService.detectEmotion(context);
      setCurrentEmotion(emotion);

      // Get adaptation
      const adaptation = await uxService.getEmotionalUXAdaptation(userId, context);

      // Check if we need a transition
      const needsTransition = JSON.stringify(currentAdaptation) !== JSON.stringify(adaptation);

      if (needsTransition) {
        // Create smooth transition
        const transition = await uxService.createSmoothTransition(
          userId,
          currentAdaptation,
          adaptation
        );
        setCurrentTransition(transition);

        // Apply transition after duration
        setTimeout(() => {
          setCurrentAdaptation(adaptation);
          setCurrentTransition(null);
          setIsTransitioning(false);
        }, transition.duration);
      } else {
        setCurrentAdaptation(adaptation);
        setIsTransitioning(false);
      }

      logger.debug({
        userId,
        emotion: emotion.primaryEmotion,
        intensity: emotion.intensity,
        transitionCreated: needsTransition
      }, 'Emotion detected and UX adapted');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to detect emotion and adapt UX');

      setIsTransitioning(false);
    }
  }, [enabled, preferences.enabled, userId, emotionService, uxService, currentAdaptation]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<EmotionalUXPreferences>) => {
    try {
      const updated = await uxService.updateUserPreferences(userId, updates);
      setPreferences(updated);

      logger.info({
        userId,
        updates: Object.keys(updates)
      }, 'Emotional UX preferences updated');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to update emotional UX preferences');
    }
  }, [userId, uxService]);

  // Emergency stop
  const emergencyStop = useCallback(async () => {
    try {
      await uxService.emergencyStop(userId);

      // Reset to neutral state
      setCurrentEmotion(null);
      setCurrentAdaptation(uxService['getNeutralAdaptation']());
      setCurrentTransition(null);
      setIsTransitioning(false);

      // Update preferences to disabled
      const updatedPrefs = { ...preferences, enabled: false };
      setPreferences(updatedPrefs);

      logger.warn({ userId }, 'Emergency stop activated for emotional UX');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to execute emergency stop');
    }
  }, [userId, uxService, preferences]);

  // Generate CSS variables for styling
  const generateCSSVariables = useCallback(() => {
    return uxService.generateCSSVariables(currentAdaptation);
  }, [uxService, currentAdaptation]);

  // Auto-detect emotion on user interactions (throttled)
  useEffect(() => {
    if (!enabled || !preferences.enabled) {
      return;
    }

    let throttleTimer: NodeJS.Timeout;

    const handleUserInteraction = (event: Event) => {
      // Throttle emotion detection to once per 5 seconds
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }

      throttleTimer = setTimeout(async () => {
        try {
          const context: EmotionContext = {
            userId,
            sessionId: 'current-session', // Would be from session management
            interactionType: 'navigation', // Could be more specific based on event
            metadata: {
              eventType: event.type,
              target: event.target ? (event.target as HTMLElement).tagName : undefined,
              timestamp: Date.now()
            }
          };

          await detectEmotion(context);
        } catch (error) {
          // Silently handle throttling errors
        }
      }, 5000);
    };

    // Listen for user interactions
    const events = ['click', 'scroll', 'keydown', 'focus', 'blur'];
    events.forEach(eventType => {
      document.addEventListener(eventType, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, handleUserInteraction);
      });
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [enabled, preferences.enabled, userId, detectEmotion]);

  // Apply CSS variables to document root
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const cssVars = generateCSSVariables();
    const root = document.documentElement;

    // Apply CSS variables
    Object.entries(cssVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Add transition class if transitioning
    if (isTransitioning) {
      root.classList.add('emotional-ux-transitioning');
    } else {
      root.classList.remove('emotional-ux-transitioning');
    }

    // Add emotion class for styling hooks
    if (currentEmotion) {
      root.setAttribute('data-emotion', currentEmotion.primaryEmotion);
      root.setAttribute('data-emotion-intensity', Math.floor(currentEmotion.intensity * 10).toString());
    } else {
      root.removeAttribute('data-emotion');
      root.removeAttribute('data-emotion-intensity');
    }

  }, [enabled, currentAdaptation, isTransitioning, currentEmotion, generateCSSVariables]);

  const contextValue: EmotionalUXContextValue = {
    currentEmotion,
    currentAdaptation,
    currentTransition,
    preferences,
    updatePreferences,
    detectEmotion,
    emergencyStop,
    generateCSSVariables,
    isTransitioning
  };

  return (
    <EmotionalUXContext.Provider value={contextValue}>
      {children}
    </EmotionalUXContext.Provider>
  );
}

export function useEmotionalUX(): EmotionalUXContextValue {
  const context = useContext(EmotionalUXContext);

  if (!context) {
    throw new Error('useEmotionalUX must be used within an EmotionalUXProvider');
  }

  return context;
}

// Hook for components that need emotion-aware behavior
export function useEmotionAware() {
  const { currentEmotion, currentAdaptation, detectEmotion } = useEmotionalUX();

  const detectFromContent = useCallback(async (content: string, interactionType: EmotionContext['interactionType'] = 'content_view') => {
    await detectEmotion({
      userId: 'current-user', // Would come from auth context
      sessionId: 'current-session',
      interactionType,
      content,
      metadata: {}
    });
  }, [detectEmotion]);

  const detectFromInteraction = useCallback(async (interactionType: EmotionContext['interactionType'], metadata: Record<string, any> = {}) => {
    await detectEmotion({
      userId: 'current-user', // Would come from auth context
      sessionId: 'current-session',
      interactionType,
      metadata
    });
  }, [detectEmotion]);

  return {
    emotion: currentEmotion,
    adaptation: currentAdaptation,
    detectFromContent,
    detectFromInteraction
  };
}

// CSS-in-JS helper for emotion-aware components
export function emotionAwareStyles(baseStyles: React.CSSProperties, adaptation: EmotionalUXAdaptation): React.CSSProperties {
  const emotionStyles: React.CSSProperties = {};

  // Apply color scheme
  if (adaptation.colorScheme.calming) {
    emotionStyles.backgroundColor = adaptation.colorScheme.background;
    emotionStyles.color = adaptation.colorScheme.text;
  }

  // Apply spacing
  const spacingMultiplier = {
    tight: 0.75,
    normal: 1.0,
    loose: 1.25
  }[adaptation.spacing.padding];

  if (spacingMultiplier) {
    emotionStyles.padding = `${(parseInt(baseStyles.padding as string) || 16) * spacingMultiplier}px`;
  }

  // Apply typography
  if (adaptation.typography.fontSize === 'large') {
    emotionStyles.fontSize = '1.125rem';
  }

  return { ...baseStyles, ...emotionStyles };
}