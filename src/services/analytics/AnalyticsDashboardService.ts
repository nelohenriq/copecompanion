import { ProgressTrackingService, ProgressReport, ProgressMetric, Goal, Achievement } from './ProgressTrackingService';
import { logger } from '@/lib/logger';

export interface DashboardData {
  userId: string;
  overview: {
    currentStreak: number;
    longestStreak: number;
    goalsCompleted: number;
    achievementsUnlocked: number;
    avgEmotionalWellbeing: number;
    weeklyProgress: number;
  };
  charts: {
    emotionalTrend: ChartDataPoint[];
    goalProgress: ChartDataPoint[];
    activityHeatmap: ActivityHeatmapData;
    achievementsTimeline: AchievementDataPoint[];
  };
  insights: {
    recent: ProgressInsight[];
    actionable: ProgressInsight[];
    trends: TrendAnalysis[];
  };
  recommendations: string[];
  generatedAt: Date;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface ActivityHeatmapData {
  data: Array<{
    date: string;
    count: number;
    intensity: 'low' | 'medium' | 'high';
  }>;
  maxCount: number;
}

export interface AchievementDataPoint {
  date: string;
  achievements: Achievement[];
  totalCount: number;
}

export interface TrendAnalysis {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  period: string;
  significance: 'high' | 'medium' | 'low';
  insight: string;
}

export interface ProgressInsight {
  id: string;
  type: 'positive' | 'concern' | 'opportunity' | 'achievement';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  data: Record<string, any>;
  createdAt: Date;
}

export interface CohortAnalysis {
  cohortId: string;
  name: string;
  userCount: number;
  avgRetention: number;
  avgProgress: number;
  topGoals: Array<{ goal: string; completionRate: number }>;
  engagementMetrics: {
    avgSessionsPerWeek: number;
    avgSessionDuration: number;
    contentCompletionRate: number;
  };
  createdAt: Date;
}

export interface PredictiveMetrics {
  userId: string;
  churnRisk: {
    probability: number;
    factors: string[];
    timeframe: string;
  };
  goalCompletion: {
    predictedGoals: Array<{ goalId: string; completionProbability: number; estimatedDate: Date }>;
  };
  engagement: {
    predictedEngagement: number;
    recommendedActions: string[];
  };
  generatedAt: Date;
}

export class AnalyticsDashboardService {
  private progressService: ProgressTrackingService;
  private dashboardCache: Map<string, DashboardData> = new Map();
  private cohortCache: Map<string, CohortAnalysis[]> = new Map();

  constructor(progressService: ProgressTrackingService) {
    this.progressService = progressService;
    this.initializeAnalytics();
  }

  private initializeAnalytics() {
    // Initialize analytics processing and caching
    logger.info('Analytics dashboard service initialized');
  }

  async generateDashboard(userId: string, forceRefresh: boolean = false): Promise<DashboardData> {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = this.dashboardCache.get(userId);
        if (cached && Date.now() - cached.generatedAt.getTime() < 30 * 60 * 1000) { // 30 minutes
          return cached;
        }
      }

      // Generate comprehensive dashboard data
      const overview = await this.generateOverview(userId);
      const charts = await this.generateCharts(userId);
      const insights = await this.generateInsights(userId);
      const recommendations = await this.generateRecommendations(userId, overview, insights);

      const dashboard: DashboardData = {
        userId,
        overview,
        charts,
        insights,
        recommendations,
        generatedAt: new Date()
      };

      // Cache the dashboard
      this.dashboardCache.set(userId, dashboard);

      logger.info({
        userId,
        insightsCount: dashboard.insights.recent.length,
        recommendationsCount: dashboard.recommendations.length
      }, 'Dashboard generated');

      return dashboard;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to generate dashboard');

      // Return minimal dashboard on error
      return {
        userId,
        overview: {
          currentStreak: 0,
          longestStreak: 0,
          goalsCompleted: 0,
          achievementsUnlocked: 0,
          avgEmotionalWellbeing: 0.5,
          weeklyProgress: 0
        },
        charts: {
          emotionalTrend: [],
          goalProgress: [],
          activityHeatmap: { data: [], maxCount: 0 },
          achievementsTimeline: []
        },
        insights: {
          recent: [],
          actionable: [],
          trends: []
        },
        recommendations: ['Unable to load dashboard data. Please try again later.'],
        generatedAt: new Date()
      };
    }
  }

  private async generateOverview(userId: string): Promise<DashboardData['overview']> {
    const goals = this.progressService.getUserGoals(userId);
    const achievements = this.progressService.getUserAchievements(userId);
    const metrics = this.progressService.getUserMetrics(userId, 100); // Last 100 metrics

    // Calculate current streak
    const activeGoals = goals.filter(g => g.status === 'active');
    const currentStreak = activeGoals.length > 0
      ? Math.max(...activeGoals.map(g => g.streak.current))
      : 0;

    const longestStreak = activeGoals.length > 0
      ? Math.max(...activeGoals.map(g => g.streak.longest))
      : 0;

    // Calculate goals completed (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCompletedGoals = goals.filter(g =>
      g.status === 'completed' && g.updatedAt >= thirtyDaysAgo
    ).length;

    // Calculate average emotional wellbeing (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEmotionalMetrics = metrics.filter(m =>
      m.metricType === 'emotional_wellbeing' && m.timestamp >= sevenDaysAgo
    );
    const avgEmotionalWellbeing = recentEmotionalMetrics.length > 0
      ? recentEmotionalMetrics.reduce((sum, m) => sum + m.value, 0) / recentEmotionalMetrics.length
      : 0.5;

    // Calculate weekly progress
    const weeklyProgress = activeGoals.length > 0
      ? activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length
      : 0;

    return {
      currentStreak,
      longestStreak,
      goalsCompleted: recentCompletedGoals,
      achievementsUnlocked: achievements.length,
      avgEmotionalWellbeing,
      weeklyProgress
    };
  }

  private async generateCharts(userId: string): Promise<DashboardData['charts']> {
    const metrics = this.progressService.getUserMetrics(userId, 1000); // Last 1000 metrics
    const achievements = this.progressService.getUserAchievements(userId);

    // Generate emotional trend (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const emotionalTrend: ChartDataPoint[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayMetrics = metrics.filter(m =>
        m.metricType === 'emotional_wellbeing' &&
        m.timestamp >= dayStart &&
        m.timestamp <= dayEnd
      );

      const avgValue = dayMetrics.length > 0
        ? dayMetrics.reduce((sum, m) => sum + m.value, 0) / dayMetrics.length
        : null;

      if (avgValue !== null) {
        emotionalTrend.push({
          date: date.toISOString().split('T')[0],
          value: avgValue,
          metadata: { sampleCount: dayMetrics.length }
        });
      }
    }

    // Generate goal progress trend
    const goals = this.progressService.getUserGoals(userId);
    const goalProgress: ChartDataPoint[] = goals
      .filter(g => g.status === 'active')
      .map(goal => ({
        date: goal.updatedAt.toISOString().split('T')[0],
        value: goal.progress,
        label: goal.title,
        metadata: { goalId: goal.id, currentValue: goal.currentValue, targetValue: goal.targetValue }
      }));

    // Generate activity heatmap (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const activityData: ActivityHeatmapData['data'] = [];

    for (let i = 89; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayActivity = metrics.filter(m =>
        m.timestamp >= dayStart && m.timestamp <= dayEnd
      ).length;

      activityData.push({
        date: date.toISOString().split('T')[0],
        count: dayActivity,
        intensity: dayActivity === 0 ? 'low' : dayActivity <= 3 ? 'medium' : 'high'
      });
    }

    const maxCount = Math.max(...activityData.map(d => d.count));

    // Generate achievements timeline
    const achievementsTimeline: AchievementDataPoint[] = [];
    const achievementsByDate = achievements.reduce((acc, achievement) => {
      const date = achievement.unlockedAt.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(achievement);
      return acc;
    }, {} as Record<string, Achievement[]>);

    Object.entries(achievementsByDate).forEach(([date, dateAchievements]) => {
      achievementsTimeline.push({
        date,
        achievements: dateAchievements,
        totalCount: dateAchievements.length
      });
    });

    return {
      emotionalTrend,
      goalProgress,
      activityHeatmap: { data: activityData, maxCount },
      achievementsTimeline
    };
  }

  private async generateInsights(userId: string): Promise<DashboardData['insights']> {
    const insights = this.progressService.getUserInsights(userId);
    const metrics = this.progressService.getUserMetrics(userId, 500);

    // Get recent insights (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentInsights = insights
      .filter(i => i.createdAt >= sevenDaysAgo)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    // Get actionable insights
    const actionableInsights = insights
      .filter(i => i.actionable && (!i.expiresAt || i.expiresAt > new Date()))
      .sort((a, b) => {
        // Sort by impact and recency
        const impactOrder = { high: 3, medium: 2, low: 1 };
        const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
        if (impactDiff !== 0) return impactDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 3);

    // Generate trend analysis
    const trends = await this.analyzeTrends(userId, metrics);

    return {
      recent: recentInsights.map(this.convertToProgressInsight),
      actionable: actionableInsights.map(this.convertToProgressInsight),
      trends
    };
  }

  private convertToProgressInsight(insight: any): ProgressInsight {
    return {
      id: insight.id,
      type: insight.type === 'risk_indicator' ? 'concern' :
            insight.type === 'progress_acceleration' ? 'positive' :
            insight.type === 'engagement_opportunity' ? 'opportunity' : 'achievement',
      title: insight.title,
      description: insight.description,
      impact: insight.impact,
      actionable: insight.actionable,
      data: insight.data,
      createdAt: insight.createdAt
    };
  }

  private async analyzeTrends(userId: string, metrics: ProgressMetric[]): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];

    // Analyze emotional wellbeing trend
    const emotionalMetrics = metrics.filter(m => m.metricType === 'emotional_wellbeing');
    if (emotionalMetrics.length >= 14) { // Need at least 2 weeks
      const firstHalf = emotionalMetrics.slice(0, Math.floor(emotionalMetrics.length / 2));
      const secondHalf = emotionalMetrics.slice(Math.floor(emotionalMetrics.length / 2));

      const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;

      const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
      const trend = Math.abs(changePercent) < 5 ? 'stable' :
                   changePercent > 0 ? 'increasing' : 'decreasing';

      trends.push({
        metric: 'emotional_wellbeing',
        trend,
        changePercent: Math.abs(changePercent),
        period: '2 weeks',
        significance: Math.abs(changePercent) > 15 ? 'high' : Math.abs(changePercent) > 8 ? 'medium' : 'low',
        insight: trend === 'increasing'
          ? 'Your emotional wellbeing has been improving'
          : trend === 'decreasing'
          ? 'Your emotional wellbeing has been declining'
          : 'Your emotional wellbeing has been stable'
      });
    }

    // Similar analysis for other metrics
    const goalMetrics = metrics.filter(m => m.metricType === 'goal_progress');
    if (goalMetrics.length >= 7) {
      // Goal progress trend analysis
      const recent = goalMetrics.slice(-7);
      const earlier = goalMetrics.slice(-14, -7);

      if (earlier.length > 0) {
        const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, m) => sum + m.value, 0) / earlier.length;
        const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;

        trends.push({
          metric: 'goal_progress',
          trend: Math.abs(changePercent) < 5 ? 'stable' :
                 changePercent > 0 ? 'increasing' : 'decreasing',
          changePercent: Math.abs(changePercent),
          period: '1 week',
          significance: Math.abs(changePercent) > 10 ? 'high' : Math.abs(changePercent) > 5 ? 'medium' : 'low',
          insight: changePercent > 0 ? 'You\'re making good progress on your goals' : 'Goal progress has slowed'
        });
      }
    }

    return trends;
  }

  private async generateRecommendations(userId: string, currentOverview: any, currentInsights: any): Promise<string[]> {
    const recommendations: string[] = [];

    // Based on overview
    if (currentOverview.avgEmotionalWellbeing < 0.4) {
      recommendations.push('Consider practicing daily mindfulness or reaching out to a mental health professional.');
    }

    if (currentOverview.currentStreak === 0 && currentOverview.goalsCompleted === 0) {
      recommendations.push('Start with small, achievable goals to build momentum and confidence.');
    }

    if (currentOverview.weeklyProgress > 0.8) {
      recommendations.push('You\'re doing great! Consider setting more challenging goals to continue growing.');
    }

    // Based on insights
    const highImpactActionable = currentInsights.actionable.filter((i: any) => i.impact === 'high');
    if (highImpactActionable.length > 0) {
      recommendations.push('Review your actionable insights for important recommendations.');
    }

    // Based on trends
    const concerningTrends = currentInsights.trends.filter((t: any) =>
      t.trend === 'decreasing' && t.significance === 'high'
    );
    if (concerningTrends.length > 0) {
      recommendations.push('Some metrics are trending downward. Consider reviewing your self-care routine.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Keep up the great work! Continue with your current routine.');
    }

    return recommendations.slice(0, 3); // Limit to top 3
  }

  async generateCohortAnalysis(cohortDefinition: {
    name: string;
    criteria: Record<string, any>;
    dateRange: { start: Date; end: Date };
  }): Promise<CohortAnalysis> {
    try {
      // This would analyze users matching the cohort criteria
      // For now, return mock data
      const cohort: CohortAnalysis = {
        cohortId: `cohort_${Date.now()}`,
        name: cohortDefinition.name,
        userCount: Math.floor(Math.random() * 1000) + 100,
        avgRetention: 0.75 + Math.random() * 0.2,
        avgProgress: 0.6 + Math.random() * 0.3,
        topGoals: [
          { goal: 'Daily mindfulness practice', completionRate: 0.85 },
          { goal: 'Regular exercise', completionRate: 0.72 },
          { goal: 'Healthy sleep habits', completionRate: 0.68 }
        ],
        engagementMetrics: {
          avgSessionsPerWeek: 4 + Math.random() * 3,
          avgSessionDuration: 25 + Math.random() * 15,
          contentCompletionRate: 0.7 + Math.random() * 0.25
        },
        createdAt: new Date()
      };

      logger.info({
        cohortId: cohort.cohortId,
        userCount: cohort.userCount
      }, 'Cohort analysis generated');

      return cohort;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        cohortName: cohortDefinition.name
      }, 'Failed to generate cohort analysis');
      throw error;
    }
  }

  async generatePredictiveMetrics(userId: string): Promise<PredictiveMetrics> {
    try {
      const metrics = this.progressService.getUserMetrics(userId, 200);
      const goals = this.progressService.getUserGoals(userId);

      // Simple predictive modeling (in reality, this would use ML models)
      const recentEmotional = metrics
        .filter(m => m.metricType === 'emotional_wellbeing')
        .slice(-14) // Last 2 weeks
        .map(m => m.value);

      const emotionalTrend = recentEmotional.length >= 7
        ? this.calculateTrend(recentEmotional.slice(-7), recentEmotional.slice(0, 7))
        : 0;

      // Predict churn risk
      const churnRisk = this.calculateChurnRisk(metrics, goals, emotionalTrend);

      // Predict goal completion
      const goalCompletion = this.predictGoalCompletion(goals, metrics);

      // Predict engagement
      const engagement = this.predictEngagement(metrics);

      const predictiveMetrics: PredictiveMetrics = {
        userId,
        churnRisk,
        goalCompletion,
        engagement,
        generatedAt: new Date()
      };

      logger.debug({
        userId,
        churnRisk: churnRisk.probability,
        predictedGoals: goalCompletion.predictedGoals.length
      }, 'Predictive metrics generated');

      return predictiveMetrics;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to generate predictive metrics');
      throw error;
    }
  }

  private calculateTrend(recent: number[], earlier: number[]): number {
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, v) => sum + v, 0) / earlier.length;
    return recentAvg - earlierAvg;
  }

  private calculateChurnRisk(metrics: ProgressMetric[], goals: Goal[], emotionalTrend: number): PredictiveMetrics['churnRisk'] {
    let riskScore = 0.1; // Base risk
    const factors: string[] = [];

    // Low emotional wellbeing increases risk
    const recentEmotional = metrics
      .filter(m => m.metricType === 'emotional_wellbeing' && m.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .map(m => m.value);

    if (recentEmotional.length > 0) {
      const avgEmotional = recentEmotional.reduce((sum, v) => sum + v, 0) / recentEmotional.length;
      if (avgEmotional < 0.4) {
        riskScore += 0.3;
        factors.push('low emotional wellbeing');
      }
    }

    // Declining emotional trend increases risk
    if (emotionalTrend < -0.1) {
      riskScore += 0.2;
      factors.push('declining emotional trend');
    }

    // Low engagement increases risk
    const recentSessions = metrics
      .filter(m => m.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .length;

    if (recentSessions < 3) {
      riskScore += 0.2;
      factors.push('low recent engagement');
    }

    // Abandoned goals increase risk
    const abandonedGoals = goals.filter(g => g.status === 'abandoned').length;
    if (abandonedGoals > goals.length * 0.5) {
      riskScore += 0.15;
      factors.push('high goal abandonment rate');
    }

    return {
      probability: Math.min(riskScore, 0.95),
      factors,
      timeframe: riskScore > 0.5 ? '1-2 weeks' : '2-4 weeks'
    };
  }

  private predictGoalCompletion(goals: Goal[], metrics: ProgressMetric[]): PredictiveMetrics['goalCompletion'] {
    const activeGoals = goals.filter(g => g.status === 'active');
    const predictedGoals = activeGoals.map(goal => {
      // Simple prediction based on recent progress
      const recentProgress = metrics
        .filter(m => m.metricType === 'goal_progress' && m.context.metadata?.goalId === goal.id)
        .slice(-7) // Last week
        .map(m => m.value);

      let completionProbability = goal.progress;
      let estimatedDate = new Date(goal.timeframe.targetDate);

      if (recentProgress.length >= 3) {
        const trend = this.calculateTrend(
          recentProgress.slice(-3),
          recentProgress.slice(0, 3)
        );

        if (trend > 0) {
          // Positive trend, adjust probability upward
          completionProbability = Math.min(completionProbability + trend * 0.5, 0.95);
          // Adjust date earlier
          const daysToAdd = Math.floor((1 - goal.progress) / (trend * 7)) * -1;
          estimatedDate.setDate(estimatedDate.getDate() + daysToAdd);
        }
      }

      return {
        goalId: goal.id,
        completionProbability,
        estimatedDate
      };
    });

    return { predictedGoals };
  }

  private predictEngagement(metrics: ProgressMetric[]): PredictiveMetrics['engagement'] {
    const recentMetrics = metrics
      .filter(m => m.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .slice(-30);

    const avgEngagement = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
      : 0.5;

    // Predict future engagement based on trend
    const firstHalf = recentMetrics.slice(0, 15);
    const secondHalf = recentMetrics.slice(15);

    let predictedEngagement = avgEngagement;
    const recommendations: string[] = [];

    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
      const trend = secondAvg - firstAvg;

      predictedEngagement = Math.max(0, Math.min(1, avgEngagement + trend));

      if (trend < -0.1) {
        recommendations.push('Consider re-engaging with content that previously interested you');
      } else if (trend > 0.1) {
        recommendations.push('Great engagement! Consider exploring new content areas');
      }
    }

    return {
      predictedEngagement,
      recommendedActions: recommendations
    };
  }

  // Cache management
  clearUserCache(userId: string): void {
    this.dashboardCache.delete(userId);
    logger.debug({ userId }, 'User dashboard cache cleared');
  }

  clearAllCache(): void {
    this.dashboardCache.clear();
    this.cohortCache.clear();
    logger.info('All analytics cache cleared');
  }

  // Analytics aggregation
  getGlobalAnalytics(): {
    totalUsers: number;
    totalGoals: number;
    totalAchievements: number;
    avgEngagement: number;
    topMetrics: Array<{ metric: string; avgValue: number; trend: string }>;
  } {
    const stats = this.progressService.getProgressStats();

    // Calculate global averages (simplified)
    const avgEngagement = 0.65; // Mock value
    const topMetrics = [
      { metric: 'emotional_wellbeing', avgValue: 0.72, trend: 'stable' },
      { metric: 'goal_progress', avgValue: 0.68, trend: 'increasing' },
      { metric: 'content_engagement', avgValue: 0.75, trend: 'stable' }
    ];

    return {
      totalUsers: stats.totalUsers,
      totalGoals: stats.totalGoals,
      totalAchievements: stats.totalAchievements,
      avgEngagement,
      topMetrics
    };
  }
}