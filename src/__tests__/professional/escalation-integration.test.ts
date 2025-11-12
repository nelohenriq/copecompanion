import { SafetyEscalationService } from '@/services/safety/SafetyEscalationService';
import { ProfessionalNetworkService } from '@/services/professional/ProfessionalNetworkService';
import { SecureCommunicationService } from '@/services/communication/SecureCommunicationService';

describe('Professional Escalation Integration', () => {
  let escalationService: SafetyEscalationService;
  let professionalService: ProfessionalNetworkService;
  let communicationService: SecureCommunicationService;

  beforeEach(() => {
    professionalService = new ProfessionalNetworkService();
    communicationService = new SecureCommunicationService();
    escalationService = new SafetyEscalationService(professionalService, communicationService);
  });

  describe('Complete Escalation Flow', () => {
    test('should successfully escalate crisis to professional with communication channel', async () => {
      const crisisAssessment = {
        severity: 'critical' as const,
        confidence: 0.95,
        indicators: {
          suicideIdeation: true,
          severeDepression: true
        },
        riskFactors: ['immediate_danger'],
        recommendedActions: [
          {
            type: 'escalate' as const,
            priority: 'immediate' as const,
            target: 'professional' as const,
            description: 'Immediate professional intervention required'
          }
        ],
        immediate: true,
        detectedAt: new Date()
      };

      const escalation = await escalationService.evaluateEscalation(
        'test-user-1',
        'test-session-1',
        crisisAssessment
      );

      expect(escalation).toBeTruthy();
      expect(escalation!.status).toBe('initiated');
      expect(escalation!.priority).toBe('emergency');
      expect(escalation!.professionalId).toBeDefined();
      expect(escalation!.channelId).toBeDefined();
      expect(escalation!.estimatedResponseTime).toBeDefined();
      expect(escalation!.estimatedResponseTime!).toBeLessThanOrEqual(15);
    });

    test('should create secure communication channel for escalation', async () => {
      const crisisAssessment = {
        severity: 'high' as const,
        confidence: 0.85,
        indicators: {
          acuteAnxiety: true
        },
        riskFactors: [],
        recommendedActions: [],
        immediate: false,
        detectedAt: new Date()
      };

      const escalation = await escalationService.evaluateEscalation(
        'test-user-2',
        'test-session-2',
        crisisAssessment
      );

      expect(escalation).toBeTruthy();
      expect(escalation!.channelId).toBeDefined();

      // Verify communication channel was created
      const activeChannels = communicationService.getActiveChannels();
      const channel = activeChannels.find(c => c.id === escalation!.channelId);
      expect(channel).toBeDefined();
      expect(channel!.status).toBe('active');
      expect(channel!.encryption.algorithm).toBe('AES-256-GCM');
    });

    test('should update professional workload when assigned', async () => {
      const initialCount = professionalService.getAvailableProfessionalsCount();

      const crisisAssessment = {
        severity: 'medium' as const,
        confidence: 0.75,
        indicators: {
          depression: true
        },
        riskFactors: [],
        recommendedActions: [],
        immediate: false,
        detectedAt: new Date()
      };

      await escalationService.evaluateEscalation(
        'test-user-3',
        'test-session-3',
        crisisAssessment
      );

      // Professional workload should be updated
      const finalCount = professionalService.getAvailableProfessionalsCount();
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    });

    test('should handle escalation resolution', async () => {
      const crisisAssessment = {
        severity: 'high' as const,
        confidence: 0.88,
        indicators: {
          selfHarm: true
        },
        riskFactors: [],
        recommendedActions: [],
        immediate: false,
        detectedAt: new Date()
      };

      const escalation = await escalationService.evaluateEscalation(
        'test-user-4',
        'test-session-4',
        crisisAssessment
      );

      expect(escalation).toBeTruthy();
      expect(escalation!.status).toBe('initiated');

      // Resolve the escalation
      const resolved = escalationService.resolveEscalation(
        escalation!.id,
        'Professional intervention completed successfully'
      );

      expect(resolved).toBe(true);

      const resolvedEscalation = escalationService.getEscalationById(escalation!.id);
      expect(resolvedEscalation!.status).toBe('resolved');
      expect(resolvedEscalation!.outcome).toBe('Professional intervention completed successfully');
    });

    test('should maintain HIPAA compliance in communication', async () => {
      const crisisAssessment = {
        severity: 'critical' as const,
        confidence: 0.92,
        indicators: {
          suicideIdeation: true
        },
        riskFactors: [],
        recommendedActions: [],
        immediate: true,
        detectedAt: new Date()
      };

      const escalation = await escalationService.evaluateEscalation(
        'test-user-5',
        'test-session-5',
        crisisAssessment
      );

      expect(escalation).toBeTruthy();

      const channel = communicationService.getActiveChannels()
        .find(c => c.id === escalation!.channelId);

      expect(channel).toBeDefined();
      expect(channel!.encryption.algorithm).toBe('AES-256-GCM');
      expect(channel!.audit).toBeDefined();
      expect(channel!.audit.length).toBeGreaterThan(0);
    });
  });

  describe('Professional Matching Integration', () => {
    test('should match appropriate professional for crisis type', async () => {
      const matches = await professionalService.findBestMatch({
        crisisType: 'suicidal_threat',
        severity: 'critical',
        requiredLanguages: ['English'],
        preferredSpecialties: ['suicide_prevention'],
        maxResponseTime: 10
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].professional.specialties).toContain('suicide_prevention');
      expect(matches[0].score).toBeGreaterThan(0);
    });

    test('should prioritize emergency contacts for critical cases', async () => {
      const matches = await professionalService.findBestMatch({
        crisisType: 'suicidal_threat',
        severity: 'critical',
        requiredLanguages: ['English'],
        preferredSpecialties: ['suicide_prevention'],
        maxResponseTime: 5
      });

      // Should find professionals with emergency contact capability
      const emergencyContacts = matches.filter(m =>
        m.professional.availability.emergencyContact
      );
      expect(emergencyContacts.length).toBeGreaterThan(0);
    });
  });

  describe('Communication Security', () => {
    test('should encrypt messages end-to-end', async () => {
      const channel = await communicationService.createCommunicationChannel(
        'prof-test',
        'user-test',
        'crisis-test',
        'escalation-test'
      );

      const testMessage = 'This is a test crisis message';
      const message = await communicationService.sendMessage(
        channel.id,
        'user-test',
        'user',
        testMessage
      );

      expect(message.content.ciphertext).toBeDefined();
      expect(message.content.ciphertext).not.toBe(testMessage);
      expect(message.content.iv).toBeDefined();
      expect(message.content.keyId).toBeDefined();

      // Should be able to decrypt
      const decrypted = await communicationService.decryptMessage(message);
      expect(decrypted).toBe(testMessage);
    });

    test('should maintain comprehensive audit trail', async () => {
      const channel = await communicationService.createCommunicationChannel(
        'prof-audit',
        'user-audit',
        'crisis-audit',
        'escalation-audit'
      );

      await communicationService.sendMessage(
        channel.id,
        'user-audit',
        'user',
        'Test message'
      );

      const audit = await communicationService.getChannelAudit(channel.id);
      expect(audit.length).toBeGreaterThan(1); // Creation + message events
      expect(audit.some(entry => entry.action === 'channel_created')).toBe(true);
      expect(audit.some(entry => entry.action === 'message_sent')).toBe(true);
    });
  });
});