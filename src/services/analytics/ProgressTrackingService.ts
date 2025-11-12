import { logger } from '@/lib/logger';

export interface ProgressMetric {
  id: string;
  userId: string;
  metricType: MetricType;
  value: number;
  timestamp: Date;
  context: ProgressContext;
  confidence: number;
  source: 'user_input' | 'behavioral' | 'ai_inference' | 'clinical_assessment';
}

export interface ProgressContext {
  sessionId?: string;
  contentId?: string;
  interactionType?: string;
  emotionalState?: string;
  metadata: Record<string, any>;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: GoalCategory;
  targetValue: number;
  currentValue: number;
  unit: string;
  timeframe: {
    startDate: Date;
    targetDate: Date;
  };
  status: GoalStatus;
  milestones: Milestone[];
  createdAt: Date;
  updatedAt: Date;
  progress: number; // 0-1
  streak: {
    current: number;
    longest: number;
    lastUpdated: Date;
  };
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  achievedAt?: Date;
  achieved: boolean;
}

export interface ProgressInsight {
  id: string;
  userId: string;
  type: InsightType;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  data: Record<string, any>;
  actionable: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ProgressReport {
  userId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    overallProgress: number;
    goalsAchieved: number;
    totalGoals: number;
    avgEmotionalStability: number;
    contentEngagement: number;
    sessionConsistency: number;
  };
  trends: {
    emotionalTrend: 'improving' | 'stable' | 'declining';
    engagementTrend: 'increasing' | 'stable' | 'decreasing';
    goalProgressTrend: 'accelerating' | 'steady' | 'slowing';
  };
  achievements: Achievement[];
  insights: ProgressInsight[];
  recommendations: string[];
  generatedAt: Date;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  unlockedAt: Date;
  progress?: number; // For partial achievements
}

export type MetricType =
  | 'emotional_wellbeing'
  | 'content_engagement'
  | 'session_frequency'
  | 'goal_progress'
  | 'skill_development'
  | 'social_connection'
  | 'self_care'
  | 'mindfulness_practice'
  | 'coping_strategy_use'
  | 'professional_help_seeking';

export type GoalCategory =
  | 'emotional_wellbeing'
  | 'daily_habits'
  | 'skill_building'
  | 'social_connection'
  | 'self_care'
  | 'professional_support';

export type GoalStatus =
  | 'active'
  | 'completed'
  | 'paused'
  | 'abandoned';

export type InsightType =
  | 'progress_acceleration'
  | 'emotional_pattern'
  | 'engagement_opportunity'
  | 'goal_adjustment'
  | 'milestone_achievement'
  | 'risk_indicator'
  | 'strength_recognition'
  | 'habit_formation';

export class ProgressTrackingService {
  private metrics: Map<string, ProgressMetric[]> = new Map();
  private goals: Map<string, Goal[]> = new Map();
  private insights: Map<string, ProgressInsight[]> = new Map();
  private achievements: Map<string, Achievement[]> = new Map();

  constructor() {
    this.initializeProgressTracking();
  }

  private initializeProgressTracking() {
    // Initialize default achievements and tracking logic
    logger.info('Progress tracking service initialized');
  }

  async recordMetric(metric: Omit<ProgressMetric, 'id'>): Promise<ProgressMetric> {
    try {
      const metricWithId: ProgressMetric = {
        ...metric,
        id: this.generateMetricId(metric.userId, metric.metricType, metric.timestamp)
      };

      const userMetrics = this.metrics.get(metric.userId) || [];
      userMetrics.push(metricWithId);

      // Keep only last 1000 metrics per user
      if (userMetrics.length > 1000) {
        userMetrics.splice(0, userMetrics.length - 1000);
      }

      this.metrics.set(metric.userId, userMetrics);

      // Trigger real-time analysis
      await this.analyzeMetricImpact(metricWithId);

      logger.debug({
        userId: metric.userId,
        metricType: metric.metricType,
        value: metric.value
      }, 'Progress metric recorded');

      return metricWithId;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: metric.userId,
        metricType: metric.metricType
      }, 'Failed to record progress metric');
      throw error;
    }
  }

  async createGoal(goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'streak'>): Promise<Goal> {
    try {
      const goal: Goal = {
        ...goalData,
        id: this.generateGoalId(goalData.userId),
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0,
        streak: {
          current: 0,
          longest: 0,
          lastUpdated: new Date()
        }
      };

      const userGoals = this.goals.get(goalData.userId) || [];
      userGoals.push(goal);
      this.goals.set(goalData.userId, userGoals);

      logger.info({
        userId: goalData.userId,
        goalId: goal.id,
        category: goal.category
      }, 'Goal created');

      return goal;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: goalData.userId
      }, 'Failed to create goal');
      throw error;
    }
  }

  async updateGoalProgress(goalId: string, userId: string, newValue: number): Promise<Goal | null> {
    try {
      const userGoals = this.goals.get(userId);
      if (!userGoals) return null;

      const goalIndex = userGoals.findIndex(g => g.id === goalId);
      if (goalIndex === -1) return null;

      const goal = userGoals[goalIndex];
      const previousValue = goal.currentValue;
      goal.currentValue = newValue;
      goal.progress = Math.min(newValue / goal.targetValue, 1.0);
      goal.updatedAt = new Date();

      // Update streak
      this.updateGoalStreak(goal, previousValue, newValue);

      // Check for milestone achievements
      await this.checkMilestoneAchievements(goal);

      // Check for goal completion
      if (goal.progress >= 1.0 && goal.status === 'active') {
        goal.status = 'completed';
        await this.awardGoalAchievement(goal);
      }

      userGoals[goalIndex] = goal;
      this.goals.set(userId, userGoals);

      logger.debug({
        userId,
        goalId,
        progress: goal.progress,
        status: goal.status
      }, 'Goal progress updated');

      return goal;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        goalId
      }, 'Failed to update goal progress');
      return null;
    }
  }

  private updateGoalStreak(goal: Goal, previousValue: number, newValue: number): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastUpdate = new Date(goal.streak.lastUpdated);
    lastUpdate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1 && newValue > previousValue) {
      // Consecutive day with progress
      goal.streak.current += 1;
      goal.streak.longest = Math.max(goal.streak.longest, goal.streak.current);
    } else if (daysDiff > 1) {
      // Streak broken
      goal.streak.current = newValue > previousValue ? 1 : 0;
    }

    goal.streak.lastUpdated = new Date();
  }

  private async checkMilestoneAchievements(goal: Goal): Promise<void> {
    for (const milestone of goal.milestones) {
      if (!milestone.achieved && goal.currentValue >= milestone.targetValue) {
        milestone.achieved = true;
        milestone.achievedAt = new Date();

        await this.awardMilestoneAchievement(goal.userId, milestone);
      }
    }
  }

  private async awardGoalAchievement(goal: Goal): Promise<void> {
    const achievement: Achievement = {
      id: this.generateAchievementId(goal.userId),
      title: `Goal Achieved: ${goal.title}`,
      description: `Successfully completed your goal to ${goal.description}`,
      icon: 'trophy',
      rarity: this.calculateGoalRarity(goal),
      unlockedAt: new Date()
    };

    const userAchievements = this.achievements.get(goal.userId) || [];
    userAchievements.push(achievement);
    this.achievements.set(goal.userId, userAchievements);

    logger.info({
      userId: goal.userId,
      goalId: goal.id,
      achievementId: achievement.id
    }, 'Goal achievement awarded');
  }

  private async awardMilestoneAchievement(userId: string, milestone: Milestone): Promise<void> {
    const achievement: Achievement = {
      id: this.generateAchievementId(userId),
      title: `Milestone Reached: ${milestone.title}`,
      description: milestone.description,
      icon: 'star',
      rarity: 'uncommon',
      unlockedAt: new Date()
    };

    const userAchievements = this.achievements.get(userId) || [];
    userAchievements.push(achievement);
    this.achievements.set(userId, userAchievements);
  }

  private calculateGoalRarity(goal: Goal): Achievement['rarity'] {
    const progress = goal.progress;
    const streak = goal.streak.longest;

    if (progress >= 1.0 && streak >= 30) return 'legendary';
    if (progress >= 1.0 && streak >= 14) return 'epic';
    if (progress >= 1.0 && streak >= 7) return 'rare';
    if (progress >= 1.0) return 'uncommon';
    return 'common';
  }

  async generateProgressReport(userId: string, period: { startDate: Date; endDate: Date }): Promise<ProgressReport> {
    try {
      const metrics = this.getMetricsInPeriod(userId, period);
      const goals = this.goals.get(userId) || [];
      const achievements = this.achievements.get(userId) || [];

      // Calculate summary metrics
      const summary = this.calculateProgressSummary(metrics, goals, period);

      // Analyze trends
      const trends = this.analyzeProgressTrends(metrics, goals, period);

      // Generate insights
      const insights = await this.generateProgressInsights(userId, metrics, goals, period);

      // Generate recommendations
      const recommendations = this.generateProgressRecommendations(insights, trends);

      const report: ProgressReport = {
        userId,
        period,
        summary,
        trends,
        achievements: achievements.filter(a =>
          a.unlockedAt >= period.startDate && a.unlockedAt <= period.endDate
        ),
        insights,
        recommendations,
        generatedAt: new Date()
      };

      logger.info({
        userId,
        period: `${period.startDate.toISOString()} to ${period.endDate.toISOString()}`,
        insightsCount: insights.length
      }, 'Progress report generated');

      return report;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to generate progress report');
      throw error;
    }
  }

  private getMetricsInPeriod(userId: string, period: { startDate: Date; endDate: Date }): ProgressMetric[] {
    const userMetrics = this.metrics.get(userId) || [];
    return userMetrics.filter(m =>
      m.timestamp >= period.startDate && m.timestamp <= period.endDate
    );
  }

  private calculateProgressSummary(
    metrics: ProgressMetric[],
    goals: Goal[],
    period: { startDate: Date; endDate: Date }
  ): ProgressReport['summary'] {
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g =>
      g.status === 'completed' &&
      g.updatedAt >= period.startDate &&
      g.updatedAt <= period.endDate
    );

    // Calculate emotional stability (average of emotional wellbeing metrics)
    const emotionalMetrics = metrics.filter(m => m.metricType === 'emotional_wellbeing');
    const avgEmotionalStability = emotionalMetrics.length > 0
      ? emotionalMetrics.reduce((sum, m) => sum + m.value, 0) / emotionalMetrics.length
      : 0.5;

    // Calculate content engagement
    const engagementMetrics = metrics.filter(m => m.metricType === 'content_engagement');
    const contentEngagement = engagementMetrics.length > 0
      ? engagementMetrics.reduce((sum, m) => sum + m.value, 0) / engagementMetrics.length
      : 0;

    // Calculate session consistency
    const sessionMetrics = metrics.filter(m => m.metricType === 'session_frequency');
    const sessionConsistency = sessionMetrics.length > 0
      ? Math.min(sessionMetrics.reduce((sum, m) => sum + m.value, 0) / sessionMetrics.length, 1.0)
      : 0;

    return {
      overallProgress: activeGoals.length > 0
        ? activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length
        : 0,
      goalsAchieved: completedGoals.length,
      totalGoals: goals.length,
      avgEmotionalStability,
      contentEngagement,
      sessionConsistency
    };
  }

  private analyzeProgressTrends(
    metrics: ProgressMetric[],
    goals: Goal[],
    period: { startDate: Date; endDate: Date }
  ): ProgressReport['trends'] {
    // Split period into two halves for trend analysis
    const midPoint = new Date((period.startDate.getTime() + period.endDate.getTime()) / 2);

    const firstHalf = metrics.filter(m => m.timestamp <= midPoint);
    const secondHalf = metrics.filter(m => m.timestamp > midPoint);

    // Emotional trend
    const firstHalfEmotional = firstHalf
      .filter(m => m.metricType === 'emotional_wellbeing')
      .reduce((sum, m) => sum + m.value, 0) / Math.max(firstHalf.filter(m => m.metricType === 'emotional_wellbeing').length, 1);

    const secondHalfEmotional = secondHalf
      .filter(m => m.metricType === 'emotional_wellbeing')
      .reduce((sum, m) => sum + m.value, 0) / Math.max(secondHalf.filter(m => m.metricType === 'emotional_wellbeing').length, 1);

    const emotionalTrend = secondHalfEmotional > firstHalfEmotional + 0.1 ? 'improving'
      : secondHalfEmotional < firstHalfEmotional - 0.1 ? 'declining' : 'stable';

    // Similar analysis for engagement and goal progress trends
    const engagementTrend = 'stable'; // Simplified
    const goalProgressTrend = 'steady'; // Simplified

    return {
      emotionalTrend: emotionalTrend as any,
      engagementTrend: engagementTrend as any,
      goalProgressTrend: goalProgressTrend as any
    };
  }

  private async generateProgressInsights(
    userId: string,
    metrics: ProgressMetric[],
    goals: Goal[],
    period: { startDate: Date; endDate: Date }
  ): Promise<ProgressInsight[]> {
    const insights: ProgressInsight[] = [];

    // Analyze emotional patterns
    const emotionalMetrics = metrics.filter(m => m.metricType === 'emotional_wellbeing');
    if (emotionalMetrics.length > 5) {
      const emotionalVariance = this.calculateVariance(emotionalMetrics.map(m => m.value));

      if (emotionalVariance > 0.3) {
        insights.push({
          id: this.generateInsightId(userId),
          userId,
          type: 'emotional_pattern',
          title: 'Emotional Variability Detected',
          description: 'Your emotional wellbeing shows significant variation. Consider tracking triggers and practicing grounding techniques.',
          impact: 'high',
          confidence: 0.85,
          data: { variance: emotionalVariance },
          actionable: true,
          createdAt: new Date()
        });
      }
    }

    // Analyze goal progress
    const activeGoals = goals.filter(g => g.status === 'active');
    const highProgressGoals = activeGoals.filter(g => g.progress > 0.8);

    if (highProgressGoals.length > 0) {
      insights.push({
        id: this.generateInsightId(userId),
        userId,
        type: 'milestone_achievement',
        title: 'Goals Near Completion',
        description: `You're close to completing ${highProgressGoals.length} goal(s). Keep up the momentum!`,
        impact: 'medium',
        confidence: 0.9,
        data: { nearCompletionGoals: highProgressGoals.map(g => g.title) },
        actionable: true,
        createdAt: new Date()
      });
    }

    // Analyze streaks
    const goalsWithStreaks = activeGoals.filter(g => g.streak.current >= 7);
    if (goalsWithStreaks.length > 0) {
      insights.push({
        id: this.generateInsightId(userId),
        userId,
        type: 'habit_formation',
        title: 'Habit Formation Success',
        description: `You've maintained consistency for ${goalsWithStreaks.length} goal(s) for a week or more. Great job building habits!`,
        impact: 'high',
        confidence: 0.95,
        data: { streakGoals: goalsWithStreaks.map(g => ({ title: g.title, streak: g.streak.current })) },
        actionable: false,
        createdAt: new Date()
      });
    }

    return insights;
  }

  private generateProgressRecommendations(insights: ProgressInsight[], trends: ProgressReport['trends']): string[] {
    const recommendations: string[] = [];

    if (trends.emotionalTrend === 'declining') {
      recommendations.push('Consider reaching out to a mental health professional for additional support.');
    }

    if (trends.engagementTrend === 'decreasing') {
      recommendations.push('Try incorporating more interactive content into your routine to maintain engagement.');
    }

    const actionableInsights = insights.filter(i => i.actionable);
    if (actionableInsights.length > 0) {
      recommendations.push('Review your recent insights for personalized suggestions to support your progress.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue with your current routine - you\'re making good progress!');
    }

    return recommendations;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  // Utility methods
  private generateMetricId(userId: string, metricType: MetricType, timestamp: Date): string {
    return `metric_${userId}_${metricType}_${timestamp.getTime()}`;
  }

  private generateGoalId(userId: string): string {
    return `goal_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInsightId(userId: string): string {
    return `insight_${userId}_${Date.now()}`;
  }

  private generateAchievementId(userId: string): string {
    return `achievement_${userId}_${Date.now()}`;
  }

  // Data access methods
  getUserGoals(userId: string): Goal[] {
    return this.goals.get(userId) || [];
  }

  getUserMetrics(userId: string, limit?: number): ProgressMetric[] {
    const metrics = this.metrics.get(userId) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  getUserAchievements(userId: string): Achievement[] {
    return this.achievements.get(userId) || [];
  }

  getUserInsights(userId: string): ProgressInsight[] {
    return this.insights.get(userId) || [];
  }

  private async analyzeMetricImpact(metric: ProgressMetric): Promise<void> {
    // Analyze the impact of a new metric and potentially generate insights
    const userMetrics = this.metrics.get(metric.userId) || [];
    const recentMetrics = userMetrics.filter(m =>
      m.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    // Check for concerning patterns
    if (metric.metricType === 'emotional_wellbeing' && metric.value < 0.3) {
      await this.generateRiskInsight(metric.userId, 'low_emotional_wellbeing', metric.value);
    }

    // Check for positive momentum
    if (metric.metricType === 'goal_progress' && metric.value > 0.8) {
      await this.generatePositiveInsight(metric.userId, 'goal_momentum', metric.value);
    }

    // Analyze engagement patterns
    const engagementMetrics = recentMetrics.filter(m => m.metricType === 'content_engagement');
    if (engagementMetrics.length > 5) {
      const avgEngagement = engagementMetrics.reduce((sum, m) => sum + m.value, 0) / engagementMetrics.length;
      if (avgEngagement > 0.8) {
        await this.generateEngagementInsight(metric.userId, avgEngagement);
      }
    }
  }

  private async generateRiskInsight(userId: string, riskType: string, severity: number): Promise<void> {
    const insight: ProgressInsight = {
      id: this.generateInsightId(userId),
      userId,
      type: 'risk_indicator',
      title: 'Support May Be Needed',
      description: 'Your recent emotional wellbeing scores suggest you may benefit from additional support. Consider reaching out to a mental health professional.',
      impact: severity < 0.2 ? 'high' : 'medium',
      confidence: 0.8,
      data: { riskType, severity },
      actionable: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
    };

    const userInsights = this.insights.get(userId) || [];
    userInsights.push(insight);
    this.insights.set(userId, userInsights);
  }

  private async generatePositiveInsight(userId: string, insightType: string, value: number): Promise<void> {
    const insight: ProgressInsight = {
      id: this.generateInsightId(userId),
      userId,
      type: 'progress_acceleration',
      title: 'Great Progress!',
      description: 'You\'re making excellent progress toward your goals. Keep up the great work!',
      impact: 'medium',
      confidence: 0.9,
      data: { insightType, value },
      actionable: false,
      createdAt: new Date()
    };

    const userInsights = this.insights.get(userId) || [];
    userInsights.push(insight);
    this.insights.set(userId, userInsights);
  }

  private async generateEngagementInsight(userId: string, avgEngagement: number): Promise<void> {
    const insight: ProgressInsight = {
      id: this.generateInsightId(userId),
      userId,
      type: 'engagement_opportunity',
      title: 'High Engagement Detected',
      description: 'You\'re highly engaged with the content. Consider exploring more advanced or related topics.',
      impact: 'low',
      confidence: 0.7,
      data: { avgEngagement },
      actionable: true,
      createdAt: new Date()
    };

    const userInsights = this.insights.get(userId) || [];
    userInsights.push(insight);
    this.insights.set(userId, userInsights);
  }

  // Analytics methods
  getProgressStats(): {
    totalUsers: number;
    totalGoals: number;
    totalAchievements: number;
    avgGoalsPerUser: number;
    completionRate: number;
  } {
    const allUsers = new Set([
      ...this.metrics.keys(),
      ...this.goals.keys(),
      ...this.achievements.keys()
    ]);

    const totalUsers = allUsers.size;
    const totalGoals = Array.from(this.goals.values()).reduce((sum, goals) => sum + goals.length, 0);
    const totalAchievements = Array.from(this.achievements.values()).reduce((sum, achievements) => sum + achievements.length, 0);

    const completedGoals = Array.from(this.goals.values())
      .flat()
      .filter(goal => goal.status === 'completed').length;

    return {
      totalUsers,
      totalGoals,
      totalAchievements,
      avgGoalsPerUser: totalUsers > 0 ? totalGoals / totalUsers : 0,
      completionRate: totalGoals > 0 ? completedGoals / totalGoals : 0
    };
  }
}