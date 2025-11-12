import { useState, useEffect, useCallback, useMemo } from 'react';
import { PersonalizationEngine, PersonalizationContext, ContentRecommendation, InteractionSuggestion } from '@/services/personalization/PersonalizationEngine';
import { logger } from '@/lib/logger';

interface UsePersonalizationOptions {
  userId: string;
  enabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // minutes
  includeSuggestions?: boolean;
}

interface UsePersonalizationReturn {
  // Data
  recommendations: ContentRecommendation[];
  suggestions: InteractionSuggestion[];
  profile: any; // UserProfile summary
  stats: any; // PersonalizationStats

  // State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  refreshRecommendations: (availableContent?: any[]) => Promise<void>;
  updateContext: (context: Partial<PersonalizationContext>) => void;
  clearCache: () => void;

  // Computed values
  topRecommendations: ContentRecommendation[];
  hasRecommendations: boolean;
  confidence: number;
}

export function usePersonalization(options: UsePersonalizationOptions): UsePersonalizationReturn {
  const {
    userId,
    enabled = true,
    autoRefresh = true,
    refreshInterval = 30, // 30 minutes
    includeSuggestions = false
  } = options;

  // State
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [suggestions, setSuggestions] = useState<InteractionSuggestion[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Context state
  const [currentContext, setCurrentContext] = useState<PersonalizationContext>({
    userId,
    currentSession: {
      startTime: new Date(),
      interactions: 0,
      contentViewed: [],
      emotionalStates: ['neutral']
    },
    recentHistory: {
      last7Days: {
        sessions: 1,
        avgDuration: 0,
        topContentTypes: [],
        emotionalVariability: 0.5
      }
    },
    environmentalFactors: {
      timeOfDay: new Date().getHours(),
      deviceType: 'web',
      networkQuality: 'normal'
    }
  });

  // Service instance (client-side only)
  const personalizationEngine = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new PersonalizationEngine();
  }, []);

  // Fetch recommendations from API
  const fetchRecommendations = useCallback(async (availableContent?: any[]) => {
    if (!enabled || !userId) return;

    try {
      setIsLoading(true);
      setError(null);

      const requestBody = {
        userId,
        context: currentContext,
        availableContent: availableContent || [],
        includeSuggestions
      };

      const response = await fetch('/api/personalization/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setRecommendations(data.recommendations || []);
      setSuggestions(data.suggestions || []);
      setProfile(data.profile || null);
      setStats(data.personalizationStats || null);
      setLastUpdated(new Date());

      logger.debug({
        userId,
        recommendationsCount: data.recommendations?.length || 0,
        suggestionsCount: data.suggestions?.length || 0
      }, 'Personalization data fetched');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to fetch personalization recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId, currentContext, includeSuggestions]);

  // Refresh recommendations
  const refreshRecommendations = useCallback(async (availableContent?: any[]) => {
    await fetchRecommendations(availableContent);
  }, [fetchRecommendations]);

  // Update context
  const updateContext = useCallback((updates: Partial<PersonalizationContext>) => {
    setCurrentContext(prev => ({
      ...prev,
      ...updates,
      currentSession: {
        ...prev.currentSession,
        ...(updates.currentSession || {})
      },
      recentHistory: {
        ...prev.recentHistory,
        ...(updates.recentHistory || {})
      },
      environmentalFactors: {
        ...prev.environmentalFactors,
        ...(updates.environmentalFactors || {})
      }
    }));
  }, []);

  // Clear cache (client-side only)
  const clearCache = useCallback(() => {
    if (personalizationEngine) {
      // This would clear any client-side caches
      logger.debug({ userId }, 'Personalization cache cleared');
    }
  }, [personalizationEngine, userId]);

  // Auto-refresh timer
  useEffect(() => {
    if (!enabled || !autoRefresh) return;

    const interval = setInterval(() => {
      fetchRecommendations();
    }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds

    return () => clearInterval(interval);
  }, [enabled, autoRefresh, refreshInterval, fetchRecommendations]);

  // Initial load
  useEffect(() => {
    if (enabled && userId) {
      fetchRecommendations();
    }
  }, [enabled, userId]); // Remove fetchRecommendations from deps to avoid infinite loop

  // Computed values
  const topRecommendations = useMemo(() => {
    return recommendations
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);
  }, [recommendations]);

  const hasRecommendations = recommendations.length > 0;
  const confidence = profile?.confidence || 0;

  return {
    recommendations,
    suggestions,
    profile,
    stats,
    isLoading,
    error,
    lastUpdated,
    refreshRecommendations,
    updateContext,
    clearCache,
    topRecommendations,
    hasRecommendations,
    confidence
  };
}

// Specialized hook for content recommendations
export function useContentRecommendations(
  userId: string,
  availableContent: any[],
  options: Omit<UsePersonalizationOptions, 'userId'> = {}
) {
  const personalization = usePersonalization({ userId, ...options });

  // Auto-update context when content changes
  useEffect(() => {
    personalization.updateContext({
      currentSession: {
        startTime: personalization.profile?.currentSession?.startTime || new Date(),
        interactions: availableContent.length,
        contentViewed: personalization.profile?.currentSession?.contentViewed || [],
        emotionalStates: personalization.profile?.currentSession?.emotionalStates || ['neutral']
      }
    });
  }, [availableContent.length, personalization]);

  return {
    ...personalization,
    // Filter recommendations to only include available content
    availableRecommendations: personalization.recommendations.filter(rec =>
      availableContent.some(content => content.id === rec.contentId)
    )
  };
}

// Hook for real-time personalization updates
export function useRealTimePersonalization(
  userId: string,
  options: Omit<UsePersonalizationOptions, 'userId'> = {}
) {
  const personalization = usePersonalization({
    userId,
    autoRefresh: true,
    refreshInterval: 5, // More frequent updates
    ...options
  });

  // Track user interactions for real-time context updates
  useEffect(() => {
    if (!personalization.profile) return;

    const handleInteraction = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target) {
        personalization.updateContext({
          currentSession: {
            startTime: personalization.profile?.currentSession?.startTime || new Date(),
            interactions: (personalization.profile?.currentSession?.interactions || 0) + 1,
            contentViewed: personalization.profile?.currentSession?.contentViewed || [],
            emotionalStates: personalization.profile?.currentSession?.emotionalStates || ['neutral']
          }
        });
      }
    };

    // Listen for user interactions
    document.addEventListener('click', handleInteraction, { passive: true });
    document.addEventListener('scroll', handleInteraction, { passive: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('scroll', handleInteraction);
    };
  }, [personalization]);

  return personalization;
}

// Hook for personalization analytics
export function usePersonalizationAnalytics(userId: string) {
  const [analytics, setAnalytics] = useState({
    totalRecommendations: 0,
    averageConfidence: 0,
    topContentTypes: [] as string[],
    engagementRate: 0,
    lastUpdated: null as Date | null
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/personalization/recommend?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');

      const data = await response.json();

      setAnalytics({
        totalRecommendations: data.stats?.totalUsers || 0,
        averageConfidence: data.profile?.confidence || 0,
        topContentTypes: data.profile?.preferences?.contentTypes || [],
        engagementRate: data.profile?.behavioralPatterns?.interactionDepth || 0,
        lastUpdated: new Date()
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to fetch personalization analytics');
    }
  }, [userId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    ...analytics,
    refreshAnalytics: fetchAnalytics
  };
}