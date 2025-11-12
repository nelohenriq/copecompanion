import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SafetyEscalationService } from '@/services/safety/SafetyEscalationService';
import { ProfessionalNetworkService } from '@/services/professional/ProfessionalNetworkService';
import { SecureCommunicationService } from '@/services/communication/SecureCommunicationService';
import { logger } from '@/lib/logger';

const escalationService = new SafetyEscalationService();
const professionalService = new ProfessionalNetworkService();
const communicationService = new SecureCommunicationService();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    const {
      userId,
      sessionId,
      crisisAssessment,
      escalationPriority = 'urgent',
      maxResponseTime = 15 // minutes
    } = body;

    // Validate required fields
    if (!userId || !sessionId || !crisisAssessment) {
      return NextResponse.json({
        error: 'Missing required fields: userId, sessionId, crisisAssessment'
      }, { status: 400 });
    }

    logger.info({
      userId,
      sessionId,
      severity: crisisAssessment.severity,
      confidence: crisisAssessment.confidence,
      escalationPriority
    }, 'Professional escalation initiated');

    // Find best professional match
    const matchCriteria = {
      crisisType: crisisAssessment.indicators?.suicideIdeation ? 'suicidal_threat' :
                 crisisAssessment.indicators?.selfHarm ? 'self_harm' :
                 crisisAssessment.indicators?.severeDepression ? 'depression' :
                 crisisAssessment.indicators?.acuteAnxiety ? 'anxiety' : 'general_crisis',
      severity: crisisAssessment.severity || 'medium',
      requiredLanguages: ['English'], // Default, would be determined from user profile
      preferredSpecialties: determineRequiredSpecialties(crisisAssessment.indicators || {}),
      maxResponseTime
    };

    const professionalMatches = await professionalService.findBestMatch(matchCriteria);

    if (professionalMatches.length === 0) {
      logger.error({
        userId,
        sessionId,
        criteria: matchCriteria
      }, 'No available professionals found for escalation');

      return NextResponse.json({
        error: 'No professionals available for immediate assistance',
        status: 'no_professionals_available',
        retryIn: 300 // 5 minutes
      }, { status: 503 });
    }

    const bestMatch = professionalMatches[0];
    const professional = bestMatch.professional;

    logger.info({
      userId,
      sessionId,
      professionalId: professional.id,
      professionalName: professional.name,
      matchScore: bestMatch.score,
      estimatedResponseTime: bestMatch.estimatedResponseTime
    }, 'Best professional match found');

    // Create secure communication channel
    const communicationChannel = await communicationService.createCommunicationChannel(
      professional.id,
      userId,
      crisisAssessment.id || `crisis-${Date.now()}`,
      `escalation-${Date.now()}`
    );

    // Initiate escalation with SafetyEscalationService
    const escalation = await escalationService.evaluateEscalation(
      userId,
      sessionId,
      {
        ...crisisAssessment,
        professionalId: professional.id,
        channelId: communicationChannel.id,
        estimatedResponseTime: bestMatch.estimatedResponseTime
      }
    );

    // Update professional workload
    await professionalService.updateProfessionalWorkload(professional.id, 1);

    // Send immediate notification to professional
    await sendProfessionalNotification(professional, {
      type: 'crisis_escalation',
      priority: escalationPriority,
      userId,
      sessionId,
      crisisAssessment,
      channelId: communicationChannel.id,
      estimatedResponseTime: bestMatch.estimatedResponseTime
    });

    logger.info({
      escalationId: escalation?.id,
      professionalId: professional.id,
      channelId: communicationChannel.id,
      estimatedResponseTime: bestMatch.estimatedResponseTime
    }, 'Professional escalation completed successfully');

    return NextResponse.json({
      success: true,
      escalation: {
        id: escalation?.id,
        status: escalation?.status,
        priority: escalation?.priority,
        professional: {
          id: professional.id,
          name: professional.name,
          title: professional.title,
          estimatedResponseTime: bestMatch.estimatedResponseTime
        },
        communication: {
          channelId: communicationChannel.id,
          status: communicationChannel.status,
          encryption: communicationChannel.encryption.algorithm
        },
        match: {
          score: bestMatch.score,
          reasoning: bestMatch.reasoning,
          availableImmediately: bestMatch.availability.immediately
        }
      },
      message: `Connecting you with ${professional.name}, ${professional.title}. Estimated response time: ${bestMatch.estimatedResponseTime} minutes.`
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Professional escalation API error');

    return NextResponse.json({
      error: 'Professional escalation service temporarily unavailable',
      status: 'service_error'
    }, { status: 500 });
  }
}

function determineRequiredSpecialties(indicators: any): string[] {
  const specialties: string[] = [];

  if (indicators.suicideIdeation) specialties.push('suicide_prevention');
  if (indicators.selfHarm) specialties.push('self_harm');
  if (indicators.severeDepression) specialties.push('depression');
  if (indicators.acuteAnxiety) specialties.push('anxiety');
  if (indicators.substanceAbuse) specialties.push('substance_abuse');
  if (indicators.eatingDisorders) specialties.push('eating_disorders');
  if (indicators.domesticViolence) specialties.push('domestic_violence');

  // Add crisis intervention as fallback
  if (specialties.length === 0) {
    specialties.push('crisis_intervention');
  }

  return specialties;
}

async function sendProfessionalNotification(
  professional: any,
  notification: {
    type: string;
    priority: string;
    userId: string;
    sessionId: string;
    crisisAssessment: any;
    channelId: string;
    estimatedResponseTime: number;
  }
): Promise<void> {
  try {
    // This would integrate with actual notification services
    // For now, log the notification that would be sent

    const notificationPayload = {
      to: professional.contactMethods.email,
      sms: professional.contactMethods.sms,
      pushToken: professional.contactMethods.pushToken,
      subject: `URGENT: Crisis Escalation - ${notification.priority.toUpperCase()}`,
      message: `New crisis case requires immediate attention. User ID: ${notification.userId}. Severity: ${notification.crisisAssessment.severity}. Please join communication channel: ${notification.channelId}`,
      data: {
        type: notification.type,
        priority: notification.priority,
        channelId: notification.channelId,
        userId: notification.userId,
        sessionId: notification.sessionId,
        crisisAssessment: notification.crisisAssessment,
        estimatedResponseTime: notification.estimatedResponseTime
      }
    };

    logger.info({
      professionalId: professional.id,
      notificationType: notification.type,
      priority: notification.priority,
      channelId: notification.channelId
    }, 'Professional notification sent');

    // Placeholder for actual notification sending
    // In production, this would call SMS, email, and push notification services

  } catch (error) {
    logger.error({
      professionalId: professional.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Professional notification failed');
  }
}

// GET endpoint for escalation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const escalationId = searchParams.get('escalationId');

    if (!escalationId) {
      return NextResponse.json({
        error: 'Missing escalationId parameter'
      }, { status: 400 });
    }

    const escalation = escalationService.getEscalationById(escalationId);

    if (!escalation) {
      return NextResponse.json({
        error: 'Escalation not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      escalation: {
        id: escalation.id,
        status: escalation.status,
        priority: escalation.priority,
        startedAt: escalation.startedAt,
        resolvedAt: escalation.resolvedAt,
        steps: escalation.steps.length,
        outcome: escalation.outcome
      }
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Escalation status check failed');

    return NextResponse.json({
      error: 'Failed to retrieve escalation status'
    }, { status: 500 });
  }
}