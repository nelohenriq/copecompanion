import { CrisisDetectionService } from '@/services/safety/CrisisDetectionService';

describe('CrisisDetectionService', () => {
  let crisisService: CrisisDetectionService;

  beforeEach(() => {
    crisisService = new CrisisDetectionService();
  });

  describe('analyzeMessage', () => {
    it('should detect suicide ideation with high confidence', async () => {
      const message = "I want to kill myself";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result).toBeTruthy();
      expect(result!.severity).toBe('critical');
      expect(result!.confidence).toBeGreaterThan(0.8);
      expect(result!.indicators.suicideIdeation).toBe(true);
    });

    it('should detect self-harm indicators', async () => {
      const message = "I keep cutting myself to feel something";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result).toBeTruthy();
      expect(result!.indicators.selfHarm).toBe(true);
      expect(result!.severity).toBe('critical');
    });

    it('should detect severe depression indicators', async () => {
      const message = "I feel worthless and hopeless about everything";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result).toBeTruthy();
      expect(result!.indicators.severeDepression).toBe(true);
    });

    it('should return null for non-crisis messages', async () => {
      const message = "I'm feeling happy today and enjoying the weather";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result).toBeNull();
    });

    it('should handle negation correctly', async () => {
      const message = "I don't want to kill myself";
      const result = await crisisService.analyzeMessageWithFilters('user1', 'session1', message);

      // Should either return null or have significantly reduced confidence
      if (result) {
        expect(result.confidence).toBeLessThan(0.5);
        expect(result.riskFactors).toContain('negation_detected');
      }
    });

    it('should reduce confidence for professional context', async () => {
      const message = "My therapist says suicide prevention is important";
      const result = await crisisService.analyzeMessageWithFilters('user1', 'session1', message);

      if (result) {
        expect(result.riskFactors).toContain('professional_context');
      }
    });

    it('should reduce confidence for hypothetical content', async () => {
      const message = "In the movie, the character wanted to kill himself";
      const result = await crisisService.analyzeMessageWithFilters('user1', 'session1', message);

      if (result) {
        expect(result.riskFactors).toContain('hypothetical_content');
      }
    });
  });

  describe('analyzeMessageWithFilters', () => {
    it('should apply false positive reduction mechanisms', async () => {
      const message = "I want to kill myself but I'm just joking";
      const result = await crisisService.analyzeMessageWithFilters('user1', 'session1', message);

      // The filtering should reduce the confidence or return null
      if (result) {
        expect(result.confidence).toBeLessThan(0.8);
      }
    });

    it('should maintain high confidence for genuine crisis indicators', async () => {
      const message = "I'm going to end my life tonight";
      const result = await crisisService.analyzeMessageWithFilters('user1', 'session1', message);

      expect(result).toBeTruthy();
      expect(result!.severity).toBe('critical');
      expect(result!.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('risk stratification', () => {
    it('should classify critical severity for suicide indicators', async () => {
      const message = "I have a plan to kill myself";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result!.severity).toBe('critical');
      expect(result!.recommendedActions.some(action => action.priority === 'immediate')).toBe(true);
    });

    it('should classify high severity for multiple indicators', async () => {
      const message = "I feel worthless, hopeless, and want to give up";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result!.severity).toBe('high');
    });

    it('should classify medium severity for moderate indicators', async () => {
      const message = "I've been feeling really down lately";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result!.severity).toBe('medium');
    });
  });

  describe('recommended actions', () => {
    it('should recommend immediate escalation for critical cases', async () => {
      const message = "I can't take this anymore, I'm going to kill myself";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      const immediateActions = result!.recommendedActions.filter(action => action.priority === 'immediate');
      expect(immediateActions.length).toBeGreaterThan(0);
      expect(immediateActions.some(action => action.type === 'escalate')).toBe(true);
    });

    it('should always recommend crisis resources', async () => {
      const message = "I'm having a really hard time";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result!.recommendedActions.some(action => action.type === 'resources')).toBe(true);
    });
  });

  describe('pattern recognition', () => {
    it('should detect regex patterns for crisis indicators', async () => {
      const message = "I am going to hurt myself badly";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result).toBeTruthy();
      expect(result!.indicators.selfHarm).toBe(true);
    });

    it('should handle case insensitive matching', async () => {
      const message = "I WANT TO DIE";
      const result = await crisisService.analyzeMessage('user1', 'session1', message);

      expect(result).toBeTruthy();
      expect(result!.indicators.suicideIdeation).toBe(true);
    });
  });

  describe('contextual analysis', () => {
    it('should consider conversation history', async () => {
      const context = {
        conversationHistory: [
          "I've been feeling down",
          "Nothing seems worth it anymore",
          "I don't see a future"
        ]
      };

      const message = "I give up";
      const result = await crisisService.analyzeMessage('user1', 'session1', message, context);

      expect(result).toBeTruthy();
      expect(result!.severity).toBe('high');
    });

    it('should analyze behavioral patterns', async () => {
      const context = {
        sessionMetadata: {
          hour: 3, // Late night
          messagesPerMinute: 8 // Rapid messaging
        }
      };

      const message = "I can't sleep and I'm panicking";
      const result = await crisisService.analyzeMessage('user1', 'session1', message, context);

      expect(result).toBeTruthy();
      expect(result!.indicators.acuteAnxiety).toBe(true);
    });
  });
});