import { NextRequest, NextResponse } from 'next/server';
import { ProgressTrackingService } from '@/services/analytics/ProgressTrackingService';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schemas
const recordMetricSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  metricType: z.enum([
    'emotional_wellbeing',
    'content_engagement',
    'session_frequency',
    'goal_progress',
    'skill_development',
    'social_connection',
    'self_care',
    'mindfulness_practice',
    'coping_strategy_use',
    'professional_help_seeking'
  ]),
  value: z.number().min(0).max(1, 'Value must be between 0 and 1'),
  context: z.object({
    sessionId: z.string().optional(),
    contentId: z.string().optional(),
    interactionType: z.string().optional(),
    emotionalState: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  }).optional(),
  source: z.enum(['user_input', 'behavioral', 'ai_inference', 'clinical_assessment']).optional()
});

const createGoalSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  title: z.string().min(1, 'Goal title is required'),
  description: z.string().min(1, 'Goal description is required'),
  category: z.enum([
    'emotional_wellbeing',
    'daily_habits',
    'skill_building',
    'social_connection',
    'self_care',
    'professional_support'
  ]),
  targetValue: z.number().min(0, 'Target value must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  timeframe: z.object({
    targetDate: z.string().datetime('Target date must be a valid ISO date')
  })
});

const updateGoalProgressSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  goalId: z.string().min(1, 'Goal ID is required'),
  newValue: z.number().min(0, 'New value must be non-negative')
});

const progressReportSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  period: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }).optional()
});

const progressService = new ProgressTrackingService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'record_metric': {
        const validationResult = recordMetricSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const { userId, metricType, value, context, source } = validationResult.data;

        const metric = await progressService.recordMetric({
          userId,
          metricType,
          value,
          timestamp: new Date(),
          context: context || { metadata: {} },
          confidence: 0.8, // Default confidence
          source: source || 'user_input'
        } as any); // Type assertion to handle metadata type issue

        logger.info({
          userId,
          metricType,
          value,
          source: metric.source
        }, 'Progress metric recorded via API');

        return NextResponse.json({
          success: true,
          metric: {
            id: metric.id,
            metricType: metric.metricType,
            value: metric.value,
            timestamp: metric.timestamp,
            confidence: metric.confidence
          }
        });
      }

      case 'create_goal': {
        const validationResult = createGoalSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const goalData = {
          ...validationResult.data,
          currentValue: 0,
          status: 'active' as const,
          milestones: [],
          timeframe: {
            startDate: new Date(),
            targetDate: new Date(validationResult.data.timeframe.targetDate)
          }
        };

        const goal = await progressService.createGoal(goalData);

        logger.info({
          userId: goal.userId,
          goalId: goal.id,
          category: goal.category
        }, 'Goal created via API');

        return NextResponse.json({
          success: true,
          goal: {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            category: goal.category,
            targetValue: goal.targetValue,
            currentValue: goal.currentValue,
            progress: goal.progress,
            status: goal.status,
            createdAt: goal.createdAt
          }
        });
      }

      case 'update_goal_progress': {
        const validationResult = updateGoalProgressSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const { userId, goalId, newValue } = validationResult.data;

        const updatedGoal = await progressService.updateGoalProgress(goalId, userId, newValue);

        if (!updatedGoal) {
          return NextResponse.json(
            { error: 'Goal not found or update failed' },
            { status: 404 }
          );
        }

        logger.info({
          userId,
          goalId,
          newValue,
          progress: updatedGoal.progress,
          status: updatedGoal.status
        }, 'Goal progress updated via API');

        return NextResponse.json({
          success: true,
          goal: {
            id: updatedGoal.id,
            title: updatedGoal.title,
            currentValue: updatedGoal.currentValue,
            progress: updatedGoal.progress,
            status: updatedGoal.status,
            updatedAt: updatedGoal.updatedAt,
            streak: updatedGoal.streak
          }
        });
      }

      case 'generate_report': {
        const validationResult = progressReportSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const { userId, period } = validationResult.data;

        // Default to last 30 days if no period specified
        const defaultPeriod = {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        };

        const reportPeriod = period ? {
          startDate: new Date(period.startDate),
          endDate: new Date(period.endDate)
        } : defaultPeriod;

        const report = await progressService.generateProgressReport(userId, reportPeriod);

        logger.info({
          userId,
          period: `${reportPeriod.startDate.toISOString()} to ${reportPeriod.endDate.toISOString()}`,
          insightsCount: report.insights.length
        }, 'Progress report generated via API');

        return NextResponse.json({
          success: true,
          report: {
            userId: report.userId,
            period: report.period,
            summary: report.summary,
            trends: report.trends,
            achievements: report.achievements.map(a => ({
              id: a.id,
              title: a.title,
              description: a.description,
              rarity: a.rarity,
              unlockedAt: a.unlockedAt
            })),
            insights: report.insights.map(i => ({
              id: i.id,
              type: i.type,
              title: i.title,
              description: i.description,
              impact: i.impact,
              actionable: i.actionable,
              createdAt: i.createdAt
            })),
            recommendations: report.recommendations,
            generatedAt: report.generatedAt
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: record_metric, create_goal, update_goal_progress, generate_report' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to process progress API request');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process progress request'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') || 'get_data';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'get_goals': {
        const goals = progressService.getUserGoals(userId);

        return NextResponse.json({
          success: true,
          goals: goals.map(goal => ({
            id: goal.id,
            title: goal.title,
            description: goal.description,
            category: goal.category,
            targetValue: goal.targetValue,
            currentValue: goal.currentValue,
            progress: goal.progress,
            status: goal.status,
            streak: goal.streak,
            createdAt: goal.createdAt,
            updatedAt: goal.updatedAt
          }))
        });
      }

      case 'get_achievements': {
        const achievements = progressService.getUserAchievements(userId);

        return NextResponse.json({
          success: true,
          achievements: achievements.map(a => ({
            id: a.id,
            title: a.title,
            description: a.description,
            icon: a.icon,
            rarity: a.rarity,
            unlockedAt: a.unlockedAt,
            progress: a.progress
          }))
        });
      }

      case 'get_metrics': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const metrics = progressService.getUserMetrics(userId, Math.min(limit, 200));

        return NextResponse.json({
          success: true,
          metrics: metrics.map(m => ({
            id: m.id,
            metricType: m.metricType,
            value: m.value,
            timestamp: m.timestamp,
            confidence: m.confidence,
            source: m.source
          }))
        });
      }

      case 'get_insights': {
        const insights = progressService.getUserInsights(userId);

        return NextResponse.json({
          success: true,
          insights: insights.map(i => ({
            id: i.id,
            type: i.type,
            title: i.title,
            description: i.description,
            impact: i.impact,
            actionable: i.actionable,
            data: i.data,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt
          }))
        });
      }

      case 'get_stats': {
        const stats = progressService.getProgressStats();

        return NextResponse.json({
          success: true,
          stats
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: get_goals, get_achievements, get_metrics, get_insights, get_stats' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to get progress data via API');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve progress data'
      },
      { status: 500 }
    );
  }
}