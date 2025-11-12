import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProgressTrackingService, Goal, Achievement, ProgressMetric, ProgressReport, ProgressInsight } from '@/services/analytics/ProgressTrackingService';
import { AnalyticsDashboardService, DashboardData, PredictiveMetrics } from '@/services/analytics/AnalyticsDashboardService';
import { logger } from '@/lib/logger';

interface UseProgressOptions {
  userId: string;
  enabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // minutes
}

interface UseProgressReturn {
  // Data
  goals: Goal[];
  achievements: Achievement[];
  metrics: ProgressMetric[];
  insights: ProgressInsight[];
  dashboard: DashboardData | null;
  predictiveMetrics: PredictiveMetrics | null;

  // State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  recordMetric: (metricType: string, value: number, context?: any) => Promise<void>;
  createGoal: (goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'streak'>) => Promise<Goal | null>;
  updateGoalProgress: (goalId: string, newValue: number) => Promise<Goal | null>;
  generateReport: (period?: { startDate: Date; endDate: Date }) => Promise<ProgressReport | null>;
  refreshDashboard: (forceRefresh?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;

  // Computed values
  activeGoals: Goal[];
  completedGoals: Goal[];
  recentAchievements: Achievement[];
  goalCompletionRate: number;
  currentStreaks: { goalId: string; streak: number }[];
  topInsights: ProgressInsight[];
}

export function useProgress(options: UseProgressOptions): UseProgressReturn {
  const {
    userId,
    enabled = true,
    autoRefresh = true,
    refreshInterval = 30 // 30 minutes
  } = options;

  // State
  const [goals, setGoals] = useState<Goal[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [metrics, setMetrics] = useState<ProgressMetric[]>([]);
  const [insights, setInsights] = useState<ProgressInsight[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [predictiveMetrics, setPredictiveMetrics] = useState<PredictiveMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Service instances (client-side only)
  const progressService = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new ProgressTrackingService();
  }, []);

  const analyticsService = useMemo(() => {
    if (typeof window === 'undefined' || !progressService) return null;
    return new AnalyticsDashboardService(progressService);
  }, [progressService]);

  // Fetch all progress data
  const fetchData = useCallback(async () => {
    if (!enabled || !userId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch data in parallel
      const [goalsData, achievementsData, metricsData, insightsData] = await Promise.all([
        fetch(`/api/progress?action=get_goals&userId=${userId}`).then(r => r.json()),
        fetch(`/api/progress?action=get_achievements&userId=${userId}`).then(r => r.json()),
        fetch(`/api/progress?action=get_metrics&userId=${userId}&limit=100`).then(r => r.json()),
        fetch(`/api/progress?action=get_insights&userId=${userId}`).then(r => r.json())
      ]);

      if (goalsData.success) setGoals(goalsData.goals || []);
      if (achievementsData.success) setAchievements(achievementsData.achievements || []);
      if (metricsData.success) setMetrics(metricsData.metrics || []);
      if (insightsData.success) setInsights(insightsData.insights || []);

      setLastUpdated(new Date());

      logger.debug({
        userId,
        goalsCount: goalsData.goals?.length || 0,
        achievementsCount: achievementsData.achievements?.length || 0,
        metricsCount: metricsData.metrics?.length || 0
      }, 'Progress data fetched');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to fetch progress data');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId]);

  // Record a new metric
  const recordMetric = useCallback(async (
    metricType: string,
    value: number,
    context?: any
  ) => {
    if (!enabled || !userId) return;

    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_metric',
          userId,
          metricType,
          value,
          context,
          source: 'user_input'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        // Refresh data to get updated metrics
        await fetchData();
        logger.debug({ userId, metricType, value }, 'Metric recorded successfully');
      } else {
        throw new Error(result.error || 'Failed to record metric');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId,
        metricType,
        value
      }, 'Failed to record metric');
    }
  }, [enabled, userId, fetchData]);

  // Create a new goal
  const createGoal = useCallback(async (
    goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'streak'>
  ): Promise<Goal | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_goal',
          ...goalData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh goals
        logger.info({ userId, goalId: result.goal.id }, 'Goal created successfully');
        return result.goal;
      } else {
        throw new Error(result.error || 'Failed to create goal');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to create goal');
      return null;
    }
  }, [enabled, userId, fetchData]);

  // Update goal progress
  const updateGoalProgress = useCallback(async (
    goalId: string,
    newValue: number
  ): Promise<Goal | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_goal_progress',
          userId,
          goalId,
          newValue
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh goals
        logger.debug({ userId, goalId, newValue }, 'Goal progress updated successfully');
        return result.goal;
      } else {
        throw new Error(result.error || 'Failed to update goal progress');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId,
        goalId
      }, 'Failed to update goal progress');
      return null;
    }
  }, [enabled, userId, fetchData]);

  // Generate progress report
  const generateReport = useCallback(async (
    period?: { startDate: Date; endDate: Date }
  ): Promise<ProgressReport | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_report',
          userId,
          period
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        logger.info({ userId }, 'Progress report generated successfully');
        return result.report;
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to generate progress report');
      return null;
    }
  }, [enabled, userId]);

  // Refresh dashboard
  const refreshDashboard = useCallback(async (forceRefresh: boolean = false) => {
    if (!enabled || !userId) return;

    try {
      const response = await fetch('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_dashboard',
          userId,
          forceRefresh
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setDashboard(result.dashboard);
        logger.debug({ userId, forceRefresh }, 'Dashboard refreshed successfully');
      } else {
        throw new Error(result.error || 'Failed to refresh dashboard');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to refresh dashboard');
    }
  }, [enabled, userId]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([fetchData(), refreshDashboard(true)]);
  }, [fetchData, refreshDashboard]);

  // Auto-refresh timer
  useEffect(() => {
    if (!enabled || !autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds

    return () => clearInterval(interval);
  }, [enabled, autoRefresh, refreshInterval, fetchData]);

  // Initial load
  useEffect(() => {
    if (enabled && userId) {
      fetchData();
      refreshDashboard();
    }
  }, [enabled, userId]); // Remove fetchData and refreshDashboard from deps to avoid infinite loop

  // Computed values
  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => g.status === 'completed'), [goals]);
  const recentAchievements = useMemo(() =>
    achievements
      .sort((a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime())
      .slice(0, 10),
    [achievements]
  );
  const goalCompletionRate = useMemo(() => {
    const totalGoals = goals.length;
    return totalGoals > 0 ? completedGoals.length / totalGoals : 0;
  }, [goals, completedGoals]);

  const currentStreaks = useMemo(() =>
    activeGoals
      .filter(g => g.streak.current > 0)
      .map(g => ({ goalId: g.id, streak: g.streak.current }))
      .sort((a, b) => b.streak - a.streak),
    [activeGoals]
  );

  const topInsights = useMemo(() =>
    insights
      .filter(i => i.actionable)
      .sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return impactOrder[b.impact] - impactOrder[a.impact];
      })
      .slice(0, 5),
    [insights]
  );

  return {
    goals,
    achievements,
    metrics,
    insights,
    dashboard,
    predictiveMetrics,
    isLoading,
    error,
    lastUpdated,
    recordMetric,
    createGoal,
    updateGoalProgress,
    generateReport,
    refreshDashboard,
    refreshData,
    activeGoals,
    completedGoals,
    recentAchievements,
    goalCompletionRate,
    currentStreaks,
    topInsights
  };
}

// Specialized hook for goal management
export function useGoals(userId: string, options: Omit<UseProgressOptions, 'userId'> = {}) {
  const progress = useProgress({ userId, ...options });

  const addGoal = useCallback(async (goalData: {
    title: string;
    description: string;
    category: string;
    targetValue: number;
    unit: string;
    targetDate: Date;
  }) => {
    return progress.createGoal({
      userId,
      title: goalData.title,
      description: goalData.description,
      category: goalData.category as any,
      targetValue: goalData.targetValue,
      unit: goalData.unit,
      currentValue: 0,
      status: 'active',
      milestones: [],
      timeframe: {
        startDate: new Date(),
        targetDate: goalData.targetDate
      }
    });
  }, [progress, userId]);

  return {
    ...progress,
    addGoal
  };
}

// Hook for analytics dashboard
export function useAnalyticsDashboard(userId: string) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_dashboard',
          userId,
          forceRefresh
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setDashboard(result.dashboard);
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to fetch analytics dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboard,
    isLoading,
    error,
    refreshDashboard: fetchDashboard
  };
}