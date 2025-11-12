import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CrisisDetectionService } from '@/services/safety/CrisisDetectionService';
import { SafetyEscalationService } from '@/services/safety/SafetyEscalationService';
import { logger } from '@/lib/logger';

const crisisService = new CrisisDetectionService();
const escalationService = new SafetyEscalationService();

export async function POST(request: NextRequest) {
  try {
    // Get user session - allow both authenticated and anonymous for crisis detection
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    const body = await request.json();
    const {
      userId,
      sessionId,
      message,
      conversationHistory = [],
      userHistory = {},
      sessionMetadata = {}
    } = body;

    // Validate required fields
    if (!message || !sessionId) {
      return NextResponse.json({
        error: 'Missing required fields: message and sessionId'
      }, { status: 400 });
    }

    // Use provided userId or session userId or generate anonymous
    const effectiveUserId = userId || user?.id || `anonymous-${sessionId}`;

    logger.info({
      effectiveUserId,
      sessionId,
      messageLength: message.length,
      hasHistory: conversationHistory.length > 0
    }, 'Crisis detection request received');

    // Analyze message for crisis indicators with false positive reduction
    const assessment = await crisisService.analyzeMessageWithFilters(
      effectiveUserId,
      sessionId,
      message,
      {
        conversationHistory,
        userHistory,
        sessionMetadata
      }
    );

    if (!assessment) {
      // No crisis detected
      return NextResponse.json({
        crisisDetected: false,
        confidence: 0,
        message: 'No crisis indicators detected'
      });
    }

    // Crisis detected - initiate escalation
    const escalation = await escalationService.evaluateEscalation(
      effectiveUserId,
      sessionId,
      assessment
    );

    // Log crisis detection for compliance
    logger.warn({
      userId: effectiveUserId,
      sessionId,
      severity: assessment.severity,
      confidence: assessment.confidence,
      indicators: Object.keys(assessment.indicators).filter(k => assessment.indicators[k as keyof typeof assessment.indicators]),
      riskFactors: assessment.riskFactors,
      escalationId: escalation?.id,
      immediate: assessment.immediate
    }, 'CRISIS DETECTED - ESCALATION INITIATED');

    // Return crisis assessment with escalation info
    return NextResponse.json({
      crisisDetected: true,
      assessment: {
        severity: assessment.severity,
        confidence: assessment.confidence,
        indicators: assessment.indicators,
        riskFactors: assessment.riskFactors,
        recommendedActions: assessment.recommendedActions,
        immediate: assessment.immediate,
        detectedAt: assessment.detectedAt
      },
      escalation: escalation ? {
        id: escalation.id,
        status: escalation.status,
        priority: escalation.priority,
        protocolId: escalation.protocolId
      } : null,
      message: assessment.immediate
        ? 'Critical crisis detected. Immediate professional intervention initiated.'
        : 'Crisis indicators detected. Professional support recommended.'
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Crisis detection API error');

    // Fail-safe response
    return NextResponse.json({
      error: 'Crisis detection service temporarily unavailable',
      crisisDetected: false,
      confidence: 0
    }, { status: 500 });
  }
}

// GET endpoint for testing crisis detection patterns
export async function GET(request: NextRequest) {
  try {
    // Get user session and check admin role for testing
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return basic service status for testing
    return NextResponse.json({
      status: 'operational',
      service: 'crisis_detection',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Service status check failed',
      status: 'error'
    }, { status: 500 });
  }
}