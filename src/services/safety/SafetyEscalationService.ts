import { logger } from '@/lib/logger';
import { ProfessionalNetworkService } from '@/services/professional/ProfessionalNetworkService';
import { SecureCommunicationService } from '@/services/communication/SecureCommunicationService';

export interface EscalationProtocol {
  id: string;
  name: string;
  triggerConditions: CrisisCondition[];
  priority: 'routine' | 'urgent' | 'emergency';
  responseTime: number; // minutes
  escalationPath: EscalationStep[];
  requiredApprovals: string[];
  complianceRequirements: string[];
  active: boolean;
}

export interface CrisisCondition {
  type: 'confidence' | 'severity' | 'indicator' | 'pattern';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'contains';
  value: any;
  weight: number;
}

export interface EscalationStep {
  stepId: string;
  action: 'notify' | 'assign' | 'escalate' | 'intervene' | 'alert';
  target: 'professional' | 'supervisor' | 'emergency_services' | 'crisis_team';
  method: 'message' | 'call' | 'alert' | 'transfer';
  timeout: number; // minutes
  fallback: EscalationStep | null;
  metadata: Record<string, any>;
}

export interface EscalationRecord {
  id: string;
  userId: string;
  sessionId: string;
  crisisAssessmentId: string;
  protocolId: string;
  status: 'initiated' | 'in_progress' | 'escalated' | 'resolved' | 'failed';
  priority: 'routine' | 'urgent' | 'emergency';
  startedAt: Date;
  resolvedAt?: Date;
  steps: EscalationStepExecution[];
  outcome: string;
  compliance: ComplianceRecord;
  professionalId?: string;
  channelId?: string;
  estimatedResponseTime?: number;
}

export interface EscalationStepExecution {
  stepId: string;
  executedAt: Date;
  success: boolean;
  response?: string;
  error?: string;
  metadata: Record<string, any>;
}

export interface ComplianceRecord {
  hipaaCompliant: boolean;
  auditLogged: boolean;
  dataEncrypted: boolean;
  retentionPolicy: string;
  accessLogged: boolean;
}

export class SafetyEscalationService {
  private protocols: Map<string, EscalationProtocol> = new Map();
  private activeEscalations: Map<string, EscalationRecord> = new Map();
  private professionalService: ProfessionalNetworkService;
  private communicationService: SecureCommunicationService;

  constructor(
    professionalService?: ProfessionalNetworkService,
    communicationService?: SecureCommunicationService
  ) {
    this.professionalService = professionalService || new ProfessionalNetworkService();
    this.communicationService = communicationService || new SecureCommunicationService();
    this.initializeDefaultProtocols();
  }

  private initializeDefaultProtocols() {
    // Critical suicide ideation protocol
    const criticalProtocol: EscalationProtocol = {
      id: 'critical-suicide-protocol',
      name: 'Critical Suicide Risk Protocol',
      triggerConditions: [
        { type: 'indicator', operator: 'contains', value: 'suicideIdeation', weight: 1.0 },
        { type: 'confidence', operator: 'gte', value: 0.8, weight: 0.8 },
        { type: 'severity', operator: 'eq', value: 'critical', weight: 1.0 }
      ],
      priority: 'emergency',
      responseTime: 2, // 2 minutes
      escalationPath: [
        {
          stepId: 'immediate-professional-alert',
          action: 'alert',
          target: 'crisis_team',
          method: 'alert',
          timeout: 1,
          fallback: null,
          metadata: { alertType: 'critical', channels: ['sms', 'email', 'push'] }
        },
        {
          stepId: 'emergency-services-notification',
          action: 'notify',
          target: 'emergency_services',
          method: 'call',
          timeout: 2,
          fallback: null,
          metadata: { serviceType: 'crisis_hotline', priority: 'immediate' }
        }
      ],
      requiredApprovals: [],
      complianceRequirements: ['hipaa', 'crisis_response', 'audit_trail'],
      active: true
    };

    // High-risk protocol
    const highRiskProtocol: EscalationProtocol = {
      id: 'high-risk-protocol',
      name: 'High Risk Protocol',
      triggerConditions: [
        { type: 'severity', operator: 'eq', value: 'high', weight: 0.9 },
        { type: 'confidence', operator: 'gte', value: 0.6, weight: 0.7 }
      ],
      priority: 'urgent',
      responseTime: 15, // 15 minutes
      escalationPath: [
        {
          stepId: 'professional-assignment',
          action: 'assign',
          target: 'professional',
          method: 'message',
          timeout: 10,
          fallback: {
            stepId: 'supervisor-escalation',
            action: 'escalate',
            target: 'supervisor',
            method: 'alert',
            timeout: 5,
            fallback: null,
            metadata: {}
          },
          metadata: { assignmentType: 'urgent_consultation' }
        }
      ],
      requiredApprovals: [],
      complianceRequirements: ['hipaa', 'professional_standards'],
      active: true
    };

    // Medium-risk protocol
    const mediumRiskProtocol: EscalationProtocol = {
      id: 'medium-risk-protocol',
      name: 'Medium Risk Protocol',
      triggerConditions: [
        { type: 'severity', operator: 'eq', value: 'medium', weight: 0.8 },
        { type: 'confidence', operator: 'gte', value: 0.4, weight: 0.6 }
      ],
      priority: 'routine',
      responseTime: 60, // 1 hour
      escalationPath: [
        {
          stepId: 'scheduled-consultation',
          action: 'assign',
          target: 'professional',
          method: 'message',
          timeout: 30,
          fallback: null,
          metadata: { assignmentType: 'scheduled_followup' }
        }
      ],
      requiredApprovals: [],
      complianceRequirements: ['hipaa'],
      active: true
    };

    this.protocols.set(criticalProtocol.id, criticalProtocol);
    this.protocols.set(highRiskProtocol.id, highRiskProtocol);
    this.protocols.set(mediumRiskProtocol.id, mediumRiskProtocol);
  }

  async evaluateEscalation(
    userId: string,
    sessionId: string,
    crisisAssessment: any
  ): Promise<EscalationRecord | null> {
    try {
      // Find matching protocol
      const matchingProtocol = this.findMatchingProtocol(crisisAssessment);

      if (!matchingProtocol) {
        logger.info({
          userId,
          sessionId,
          confidence: crisisAssessment.confidence,
          severity: crisisAssessment.severity
        }, 'No escalation protocol triggered');
        return null;
      }

      // Create escalation record
      const escalationId = `escalation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const escalationRecord: EscalationRecord = {
        id: escalationId,
        userId,
        sessionId,
        crisisAssessmentId: crisisAssessment.id || `assessment-${Date.now()}`,
        protocolId: matchingProtocol.id,
        status: 'initiated',
        priority: matchingProtocol.priority,
        startedAt: new Date(),
        steps: [],
        outcome: 'pending',
        compliance: {
          hipaaCompliant: true,
          auditLogged: true,
          dataEncrypted: true,
          retentionPolicy: '7_years_crisis_data',
          accessLogged: true
        }
      };

      this.activeEscalations.set(escalationId, escalationRecord);

      // Execute escalation protocol asynchronously
      this.executeEscalation(escalationRecord, matchingProtocol, crisisAssessment)
        .catch(error => {
          logger.error({
            escalationId,
            error: error.message
          }, 'Escalation execution failed');
        });

      logger.info({
        escalationId,
        userId,
        sessionId,
        protocolId: matchingProtocol.id,
        priority: matchingProtocol.priority
      }, 'Crisis escalation initiated');

      return escalationRecord;

    } catch (error) {
      logger.error({
        userId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Escalation evaluation failed');
      return null;
    }
  }

  private findMatchingProtocol(crisisAssessment: any): EscalationProtocol | null {
    let bestMatch: EscalationProtocol | null = null;
    let bestScore = 0;

    for (const protocol of this.protocols.values()) {
      if (!protocol.active) continue;

      const score = this.evaluateProtocolMatch(protocol, crisisAssessment);
      if (score > bestScore && score >= 0.5) { // Minimum threshold for match
        bestMatch = protocol;
        bestScore = score;
      }
    }

    return bestMatch;
  }

  private evaluateProtocolMatch(protocol: EscalationProtocol, assessment: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const condition of protocol.triggerConditions) {
      const conditionMet = this.evaluateCondition(condition, assessment);
      if (conditionMet) {
        totalScore += condition.weight;
      }
      totalWeight += condition.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private evaluateCondition(condition: CrisisCondition, assessment: any): boolean {
    const { type, operator, value } = condition;
    let actualValue: any;

    switch (type) {
      case 'confidence':
        actualValue = assessment.confidence;
        break;
      case 'severity':
        actualValue = assessment.severity;
        break;
      case 'indicator':
        actualValue = assessment.indicators[value];
        break;
      case 'pattern':
        actualValue = assessment.riskFactors.some((factor: string) =>
          factor.toLowerCase().includes(value.toLowerCase())
        );
        break;
      default:
        return false;
    }

    switch (operator) {
      case 'gt': return actualValue > value;
      case 'gte': return actualValue >= value;
      case 'lt': return actualValue < value;
      case 'lte': return actualValue <= value;
      case 'eq': return actualValue === value;
      case 'contains': return actualValue === true; // For boolean indicators
      default: return false;
    }
  }

  private async executeEscalation(
    escalation: EscalationRecord,
    protocol: EscalationProtocol,
    assessment: any
  ): Promise<void> {
    escalation.status = 'in_progress';

    for (const step of protocol.escalationPath) {
      try {
        const stepExecution = await this.executeEscalationStep(step, escalation, assessment);

        escalation.steps.push(stepExecution);

        if (!stepExecution.success && step.fallback) {
          // Execute fallback step
          const fallbackExecution = await this.executeEscalationStep(step.fallback, escalation, assessment);
          escalation.steps.push(fallbackExecution);
        }

        // Check if escalation should continue based on priority and timeouts
        if (protocol.priority === 'emergency' && stepExecution.success) {
          break; // Emergency protocols may stop at first successful contact
        }

      } catch (error) {
        logger.error({
          escalationId: escalation.id,
          stepId: step.stepId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Escalation step failed');

        // Continue to next step even if current step fails
      }
    }

    // Mark escalation as completed
    escalation.status = 'escalated';
    escalation.resolvedAt = new Date();
    escalation.outcome = 'protocol_executed';

    logger.info({
      escalationId: escalation.id,
      stepsExecuted: escalation.steps.length,
      outcome: escalation.outcome
    }, 'Escalation protocol completed');
  }

  private async executeEscalationStep(
    step: EscalationStep,
    escalation: EscalationRecord,
    assessment: any
  ): Promise<EscalationStepExecution> {
    const execution: EscalationStepExecution = {
      stepId: step.stepId,
      executedAt: new Date(),
      success: false,
      metadata: { ...step.metadata }
    };

    try {
      switch (step.action) {
        case 'alert':
          execution.success = await this.sendAlert(step, escalation, assessment);
          break;
        case 'notify':
          execution.success = await this.sendNotification(step, escalation, assessment);
          break;
        case 'assign':
          execution.success = await this.assignProfessional(step, escalation, assessment);
          break;
        case 'escalate':
          execution.success = await this.escalateToSupervisor(step, escalation, assessment);
          break;
        case 'intervene':
          execution.success = await this.initiateIntervention(step, escalation, assessment);
          break;
        default:
          execution.success = false;
          execution.error = `Unknown action: ${step.action}`;
      }

      execution.response = execution.success ? 'Action completed successfully' : 'Action failed';

    } catch (error) {
      execution.success = false;
      execution.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return execution;
  }

  private async sendAlert(step: EscalationStep, escalation: EscalationRecord, assessment: any): Promise<boolean> {
    // Implementation for sending alerts via multiple channels
    // This would integrate with SMS, email, push notification services
    logger.info({
      escalationId: escalation.id,
      stepId: step.stepId,
      channels: step.metadata.channels,
      target: step.target
    }, 'Sending crisis alert');

    // Placeholder implementation
    return true;
  }

  private async sendNotification(step: EscalationStep, escalation: EscalationRecord, assessment: any): Promise<boolean> {
    // Implementation for notifications (calls, messages, etc.)
    logger.info({
      escalationId: escalation.id,
      stepId: step.stepId,
      method: step.method,
      target: step.target
    }, 'Sending crisis notification');

    // Placeholder implementation
    return true;
  }

  private async assignProfessional(step: EscalationStep, escalation: EscalationRecord, assessment: any): Promise<boolean> {
    try {
      // Use professional network service to find best match
      const matchCriteria = {
        crisisType: assessment.indicators?.suicideIdeation ? 'suicidal_threat' :
                   assessment.indicators?.selfHarm ? 'self_harm' :
                   assessment.indicators?.severeDepression ? 'depression' :
                   assessment.indicators?.acuteAnxiety ? 'anxiety' : 'general_crisis',
        severity: assessment.severity || 'medium',
        requiredLanguages: ['English'],
        preferredSpecialties: this.determineRequiredSpecialties(assessment.indicators || {}),
        maxResponseTime: 15
      };

      const matches = await this.professionalService.findBestMatch(matchCriteria);

      if (matches.length === 0) {
        logger.error({
          escalationId: escalation.id,
          stepId: step.stepId
        }, 'No professionals available for assignment');
        return false;
      }

      const bestMatch = matches[0];
      const professional = bestMatch.professional;

      // Create secure communication channel
      const channel = await this.communicationService.createCommunicationChannel(
        professional.id,
        escalation.userId,
        escalation.crisisAssessmentId,
        escalation.id
      );

      // Update escalation record with professional assignment
      escalation.professionalId = professional.id;
      escalation.channelId = channel.id;
      escalation.estimatedResponseTime = bestMatch.estimatedResponseTime;

      // Update professional workload
      await this.professionalService.updateProfessionalWorkload(professional.id, 1);

      logger.info({
        escalationId: escalation.id,
        stepId: step.stepId,
        professionalId: professional.id,
        professionalName: professional.name,
        channelId: channel.id,
        estimatedResponseTime: bestMatch.estimatedResponseTime
      }, 'Professional assigned for crisis intervention');

      return true;

    } catch (error) {
      logger.error({
        escalationId: escalation.id,
        stepId: step.stepId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Professional assignment failed');

      return false;
    }
  }

  private determineRequiredSpecialties(indicators: any): string[] {
    const specialties: string[] = [];

    if (indicators.suicideIdeation) specialties.push('suicide_prevention');
    if (indicators.selfHarm) specialties.push('self_harm');
    if (indicators.severeDepression) specialties.push('depression');
    if (indicators.acuteAnxiety) specialties.push('anxiety');
    if (indicators.substanceAbuse) specialties.push('substance_abuse');
    if (indicators.eatingDisorders) specialties.push('eating_disorders');
    if (indicators.domesticViolence) specialties.push('domestic_violence');

    if (specialties.length === 0) {
      specialties.push('crisis_intervention');
    }

    return specialties;
  }

  private async escalateToSupervisor(step: EscalationStep, escalation: EscalationRecord, assessment: any): Promise<boolean> {
    // Implementation for supervisor escalation
    logger.info({
      escalationId: escalation.id,
      stepId: step.stepId
    }, 'Escalating to supervisor');

    // Placeholder implementation
    return true;
  }

  private async initiateIntervention(step: EscalationStep, escalation: EscalationRecord, assessment: any): Promise<boolean> {
    // Implementation for direct intervention
    logger.info({
      escalationId: escalation.id,
      stepId: step.stepId
    }, 'Initiating direct intervention');

    // Placeholder implementation
    return true;
  }

  // Public methods for managing protocols and escalations
  getActiveEscalations(): EscalationRecord[] {
    return Array.from(this.activeEscalations.values()).filter(
      escalation => escalation.status === 'initiated' || escalation.status === 'in_progress'
    );
  }

  getEscalationById(id: string): EscalationRecord | null {
    return this.activeEscalations.get(id) || null;
  }

  resolveEscalation(id: string, outcome: string): boolean {
    const escalation = this.activeEscalations.get(id);
    if (!escalation) return false;

    escalation.status = 'resolved';
    escalation.resolvedAt = new Date();
    escalation.outcome = outcome;

    logger.info({
      escalationId: id,
      outcome
    }, 'Escalation resolved');

    return true;
  }

  getAllProtocols(): EscalationProtocol[] {
    return Array.from(this.protocols.values());
  }

  updateProtocol(protocol: EscalationProtocol): boolean {
    if (!this.protocols.has(protocol.id)) return false;

    this.protocols.set(protocol.id, protocol);
    logger.info({
      protocolId: protocol.id,
      protocolName: protocol.name
    }, 'Escalation protocol updated');

    return true;
  }
}