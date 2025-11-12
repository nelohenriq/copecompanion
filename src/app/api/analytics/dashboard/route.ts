import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsDashboardService } from '@/services/analytics/AnalyticsDashboardService';
import { ProgressTrackingService } from '@/services/analytics/ProgressTrackingService';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schemas
const dashboardRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  forceRefresh: z.boolean().optional()
});

const cohortAnalysisSchema = z.object({
  name: z.string().min(1, 'Cohort name is required'),
  criteria: z.record(z.string(), z.any()),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  })
});

const predictiveMetricsSchema = z.object({
  userId: z.string().min(1, 'User ID is required')
});

const progressService = new ProgressTrackingService();
const analyticsService = new AnalyticsDashboardService(progressService);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'get_dashboard': {
        const validationResult = dashboardRequestSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const { userId, forceRefresh = false } = validationResult.data;

        const dashboard = await analyticsService.generateDashboard(userId, forceRefresh);

        logger.info({
          userId,
          forceRefresh,
          insightsCount: dashboard.insights.recent.length + dashboard.insights.actionable.length,
          recommendationsCount: dashboard.recommendations.length
        }, 'Dashboard generated via API');

        return NextResponse.json({
          success: true,
          dashboard: {
            userId: dashboard.userId,
            overview: dashboard.overview,
            charts: {
              emotionalTrend: dashboard.charts.emotionalTrend,
              goalProgress: dashboard.charts.goalProgress,
              activityHeatmap: dashboard.charts.activityHeatmap,
              achievementsTimeline: dashboard.charts.achievementsTimeline
            },
            insights: {
              recent: dashboard.insights.recent,
              actionable: dashboard.insights.actionable,
              trends: dashboard.insights.trends
            },
            recommendations: dashboard.recommendations,
            generatedAt: dashboard.generatedAt
          }
        });
      }

      case 'cohort_analysis': {
        const validationResult = cohortAnalysisSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const cohortData = {
          ...validationResult.data,
          dateRange: {
            start: new Date(validationResult.data.dateRange.start),
            end: new Date(validationResult.data.dateRange.end)
          }
        };

        const cohort = await analyticsService.generateCohortAnalysis(cohortData);

        logger.info({
          cohortId: cohort.cohortId,
          userCount: cohort.userCount,
          avgProgress: cohort.avgProgress
        }, 'Cohort analysis generated via API');

        return NextResponse.json({
          success: true,
          cohort: {
            cohortId: cohort.cohortId,
            name: cohort.name,
            userCount: cohort.userCount,
            avgRetention: cohort.avgRetention,
            avgProgress: cohort.avgProgress,
            topGoals: cohort.topGoals,
            engagementMetrics: cohort.engagementMetrics,
            createdAt: cohort.createdAt
          }
        });
      }

      case 'predictive_metrics': {
        const validationResult = predictiveMetricsSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const { userId } = validationResult.data;

        const predictiveMetrics = await analyticsService.generatePredictiveMetrics(userId);

        logger.info({
          userId,
          churnRisk: predictiveMetrics.churnRisk.probability,
          predictedGoals: predictiveMetrics.goalCompletion.predictedGoals.length
        }, 'Predictive metrics generated via API');

        return NextResponse.json({
          success: true,
          predictiveMetrics: {
            userId: predictiveMetrics.userId,
            churnRisk: predictiveMetrics.churnRisk,
            goalCompletion: predictiveMetrics.goalCompletion,
            engagement: predictiveMetrics.engagement,
            generatedAt: predictiveMetrics.generatedAt
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: get_dashboard, cohort_analysis, predictive_metrics' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to process analytics API request');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process analytics request'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'global_stats';

    switch (action) {
      case 'global_stats': {
        const stats = analyticsService.getGlobalAnalytics();

        return NextResponse.json({
          success: true,
          stats
        });
      }

      case 'clear_cache': {
        const userId = searchParams.get('userId');

        if (userId) {
          analyticsService.clearUserCache(userId);
          logger.info({ userId }, 'User analytics cache cleared via API');
        } else {
          analyticsService.clearAllCache();
          logger.info('All analytics cache cleared via API');
        }

        return NextResponse.json({
          success: true,
          message: userId ? `Cache cleared for user ${userId}` : 'All cache cleared'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: global_stats, clear_cache' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to get analytics data via API');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve analytics data'
      },
      { status: 500 }
    );
  }
}