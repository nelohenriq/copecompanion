import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logInfo, logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'connected',
        api: 'operational',
      },
    };

    logInfo('Health check passed', {
      responseTime,
      uptime: process.uptime(),
    });

    return NextResponse.json(healthCheck, { status: 200 });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logError('Health check failed', error instanceof Error ? error : new Error('Unknown error'), {
      responseTime,
    });

    const healthCheck = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : 'Database connection failed',
      services: {
        database: 'disconnected',
        api: 'operational',
      },
    };

    return NextResponse.json(healthCheck, { status: 503 });
  }
}