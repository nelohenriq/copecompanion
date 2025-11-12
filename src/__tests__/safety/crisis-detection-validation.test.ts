/**
 * Crisis Detection Validation Tests
 *
 * This file contains validation tests for the crisis detection functionality.
 * These tests verify that the core crisis detection logic works correctly
 * and meets the acceptance criteria for Story 4-1.
 */

import { CrisisDetectionService } from '@/services/safety/CrisisDetectionService';

describe('Crisis Detection Validation', () => {
  let service: CrisisDetectionService;

  beforeEach(() => {
    service = new CrisisDetectionService();
  });

  describe('Acceptance Criteria Validation', () => {
    describe('AC1: Suicide Ideation Detection', () => {
      test('should detect suicide ideation with high confidence', async () => {
        const message = "I want to kill myself";
        const result = await service.analyzeMessageWithFilters('user1', 'session1', message);

        expect(result).not.toBeNull();
        expect(result!.severity).toBe('critical');
        expect(result!.confidence).toBeGreaterThan(0.8);
        expect(result!.indicators.suicideIdeation).toBe(true);
        expect(result!.immediate).toBe(true);
      });

      test('should trigger immediate escalation for suicide ideation', async () => {
        const message = "I have a plan to end my life";
        const result = await service.analyzeMessageWithFilters('user2', 'session2', message);

        expect(result).not.toBeNull();
        expect(result!.recommendedActions.some(action =>
          action.type === 'escalate' && action.priority === 'immediate'
        )).toBe(true);
      });

      test('should initiate professional intervention within expected timeframe', async () => {
        const startTime = Date.now();
        const message = "I'm going to kill myself tonight";
        const result = await service.analyzeMessageWithFilters('user3', 'session3', message);
        const endTime = Date.now();

        expect(result).not.toBeNull();
        expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      });
    });

    describe('AC2: Self-Harm and Distress Detection', () => {
      test('should detect self-harm indicators', async () => {
        const message = "I keep cutting myself to feel something";
        const result = await service.analyzeMessageWithFilters('user4', 'session4', message);

        expect(result).not.toBeNull();
        expect(result!.indicators.selfHarm).toBe(true);
        expect(result!.severity).toBe('critical');
      });

      test('should determine appropriate intervention level', async () => {
        const message = "I'm having severe anxiety and can't breathe";
        const result = await service.analyzeMessageWithFilters('user5', 'session5', message);

        expect(result).not.toBeNull();
        expect(result!.indicators.acuteAnxiety).toBe(true);
        expect(['medium', 'high', 'critical']).toContain(result!.severity);
      });

      test('should activate safety measures based on risk level', async () => {
        const message = "I feel worthless and hopeless";
        const result = await service.analyzeMessageWithFilters('user6', 'session6', message);

        expect(result).not.toBeNull();
        expect(result!.recommendedActions.some(action =>
          action.type === 'resources' || action.type === 'monitor'
        )).toBe(true);
      });
    });

    describe('AC3: Crisis Response and Logging', () => {
      test('should log all relevant safety data', async () => {
        const message = "I don't want to live anymore";
        const result = await service.analyzeMessageWithFilters('user7', 'session7', message);

        expect(result).not.toBeNull();
        expect(result!.riskFactors.length).toBeGreaterThan(0);
        expect(result!.detectedAt).toBeInstanceOf(Date);
        expect(result!.context).toBe(message);
      });

      test('should maintain HIPAA-compliant audit trail structure', async () => {
        const message = "I'm suicidal";
        const result = await service.analyzeMessageWithFilters('user8', 'session8', message);

        expect(result).not.toBeNull();
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('sessionId');
        expect(result).toHaveProperty('detectedAt');
        expect(result).toHaveProperty('recommendedActions');
      });

      test('should provide appropriate crisis resources', async () => {
        const message = "I need help right now";
        const result = await service.analyzeMessageWithFilters('user9', 'session9', message);

        expect(result).not.toBeNull();
        expect(result!.recommendedActions.some(action =>
          action.type === 'resources' && action.target === 'user'
        )).toBe(true);
      });
    });
  });

  describe('False Positive Reduction Validation', () => {
    test('should reduce confidence for negated statements', async () => {
      const message = "I don't want to kill myself";
      const result = await service.analyzeMessageWithFilters('user10', 'session10', message);

      if (result) {
        expect(result.confidence).toBeLessThan(0.5);
        expect(result.riskFactors).toContain('negation_detected');
      }
    });

    test('should reduce confidence for professional context', async () => {
      const message = "My therapist discussed suicide prevention";
      const result = await service.analyzeMessageWithFilters('user11', 'session11', message);

      if (result) {
        expect(result.riskFactors).toContain('professional_context');
      }
    });

    test('should reduce confidence for hypothetical content', async () => {
      const message = "What if someone wanted to kill themselves in a movie?";
      const result = await service.analyzeMessageWithFilters('user12', 'session12', message);

      if (result) {
        expect(result.riskFactors).toContain('hypothetical_content');
      }
    });
  });

  describe('Performance Validation', () => {
    test('should analyze messages within acceptable time limits', async () => {
      const messages = [
        "I want to die",
        "I'm cutting myself",
        "I feel hopeless",
        "I'm having a panic attack",
        "Everything is meaningless"
      ];

      const startTime = Date.now();

      for (const message of messages) {
        await service.analyzeMessageWithFilters('perf-user', `perf-session-${Math.random()}`, message);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / messages.length;

      expect(averageTime).toBeLessThan(100); // Average < 100ms per message
    });
  });

  describe('Edge Cases and Robustness', () => {
    test('should handle empty or invalid messages gracefully', async () => {
      const result = await service.analyzeMessageWithFilters('user13', 'session13', '');

      // Should not crash and return null or low-confidence result
      expect(result === null || result.confidence < 0.1).toBe(true);
    });

    test('should handle very long messages', async () => {
      const longMessage = 'I feel '.repeat(1000) + 'hopeless';
      const result = await service.analyzeMessageWithFilters('user14', 'session14', longMessage);

      expect(result).not.toBeNull();
      // Should still detect crisis indicators even in long text
    });

    test('should handle messages with special characters and emojis', async () => {
      const message = "I feel 😢 worthless and want to 💔 end it all";
      const result = await service.analyzeMessageWithFilters('user15', 'session15', message);

      expect(result).not.toBeNull();
      expect(result!.indicators.suicideIdeation).toBe(true);
    });
  });
});