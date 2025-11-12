import { NextRequest, NextResponse } from 'next/server';
import { PerformanceMonitor, ErrorTracker } from '@/lib/monitoring';
import { logInfo } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const monitor = PerformanceMonitor.getInstance();
    const errorTracker = ErrorTracker.getInstance();

    const metrics = {
      timestamp: new Date().toISOString(),
      performance: monitor.getAllMetrics(),
      errors: {
        recentCount: errorTracker.getErrorCount(),
        recentErrors: errorTracker.getRecentErrors(5).map(({ error, context, timestamp }) => ({
          message: error.message,
          stack: error.stack,
          context,
          timestamp: timestamp.toISOString(),
        })),
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform,
      },
    };

    logInfo('Metrics endpoint accessed', {
      performanceMetrics: Object.keys(metrics.performance).length,
      errorCount: metrics.errors.recentCount,
    });

    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}