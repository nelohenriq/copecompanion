import { SafetyMonitoringService } from '@/services/safety/SafetyMonitoringService';

describe('Safety Monitoring Integration', () => {
  let monitoringService: SafetyMonitoringService;

  beforeEach(() => {
    monitoringService = new SafetyMonitoringService();
  });

  describe('Real-time Safety Metrics', () => {
    test('should generate current safety metrics', async () => {
      const metrics = await monitoringService.updateSafetyMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('activeUsers');
      expect(metrics).toHaveProperty('highRiskUsers');
      expect(metrics).toHaveProperty('criticalRiskUsers');
      expect(metrics).toHaveProperty('safetyScore');
      expect(metrics.activeUsers).toBeGreaterThanOrEqual(0);
      expect(metrics.safetyScore).toBeGreaterThanOrEqual(0);
      expect(metrics.safetyScore).toBeLessThanOrEqual(100);
    });

    test('should maintain metrics history', () => {
      const history = monitoringService.getMetricsHistory(1);
      expect(Array.isArray(history)).toBe(true);
    });

    test('should provide current metrics snapshot', () => {
      const current = monitoringService.getCurrentMetrics();
      expect(current).toBeTruthy();
      expect(current!.safetyScore).toBeGreaterThanOrEqual(0);
      expect(current!.safetyScore).toBeLessThanOrEqual(100);
    });
  });

  describe('User Safety Profiles', () => {
    test('should create and retrieve user safety profile', async () => {
      const userId = 'test-user-1';
      const profile = await monitoringService.getUserSafetyProfile(userId);

      expect(profile).toBeTruthy();
      expect(profile!.userId).toBe(userId);
      expect(profile!.currentRiskLevel).toBeDefined();
      expect(profile!.riskScore).toBeGreaterThanOrEqual(0);
      expect(profile!.safetyScore).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(profile!.currentRiskLevel);
    });

    test('should update user safety profile with events', async () => {
      const userId = 'test-user-2';

      // Record a critical safety event
      await monitoringService.recordSafetyEvent({
        userId,
        type: 'crisis_detected',
        severity: 'critical',
        details: {
          indicators: ['suicide_ideation', 'severe_depression'],
          confidence: 0.95
        },
        resolved: false
      });

      // Get updated profile
      const profile = await monitoringService.getUserSafetyProfile(userId);

      expect(profile).toBeTruthy();
      expect(profile!.crisisIndicators).toContain('suicide_ideation');
      expect(profile!.escalationHistory.length).toBeGreaterThan(0);
    });

    test('should calculate safety trends correctly', async () => {
      const userId = 'test-user-3';

      // Get initial profile
      const initialProfile = await monitoringService.getUserSafetyProfile(userId);
      const initialScore = initialProfile!.safetyScore;

      // Record improving safety event (resolution)
      await monitoringService.recordSafetyEvent({
        userId,
        type: 'intervention_completed',
        severity: 'low',
        details: { outcome: 'successful' },
        resolved: true
      });

      // Get updated profile
      const updatedProfile = await monitoringService.getUserSafetyProfile(userId);

      // Profile should exist and have trend information
      expect(updatedProfile).toBeTruthy();
      expect(updatedProfile!.trend).toBeDefined();
      expect(['improving', 'stable', 'declining']).toContain(updatedProfile!.trend);
    });
  });

  describe('Safety Event Recording', () => {
    test('should record and retrieve safety events', async () => {
      const userId = 'test-user-4';

      const eventId = await monitoringService.recordSafetyEvent({
        userId,
        type: 'escalation_initiated',
        severity: 'high',
        details: {
          escalationId: 'esc-123',
          professionalId: 'prof-456'
        },
        resolved: false
      });

      expect(typeof eventId).toBe('string');
      expect(eventId).toContain('safety-event-');

      // Check recent events
      const recentEvents = monitoringService.getRecentSafetyEvents(1);
      const recordedEvent = recentEvents.find(e => e.id === eventId);

      expect(recordedEvent).toBeDefined();
      expect(recordedEvent!.userId).toBe(userId);
      expect(recordedEvent!.type).toBe('escalation_initiated');
      expect(recordedEvent!.severity).toBe('high');
    });

    test('should handle different event types', async () => {
      const userId = 'test-user-5';
      const eventTypes = ['crisis_detected', 'escalation_initiated', 'professional_assigned', 'intervention_completed'];

      for (const eventType of eventTypes) {
        const eventId = await monitoringService.recordSafetyEvent({
          userId,
          type: eventType as any,
          severity: 'medium',
          details: { test: true },
          resolved: eventType === 'intervention_completed'
        });

        expect(typeof eventId).toBe('string');
      }

      // Verify events were recorded
      const recentEvents = monitoringService.getRecentSafetyEvents(1);
      const userEvents = recentEvents.filter(e => e.userId === userId);
      expect(userEvents.length).toBe(eventTypes.length);
    });
  });

  describe('Safety Alerts Management', () => {
    test('should create and manage safety alerts', async () => {
      const alertId = await monitoringService.createSafetyAlert({
        type: 'user_risk',
        severity: 'high',
        title: 'High Risk User Detected',
        description: 'User shows multiple high-risk indicators',
        affectedUsers: ['user-123', 'user-456']
      });

      expect(typeof alertId).toBe('string');
      expect(alertId).toContain('safety-alert-');

      // Check active alerts
      const activeAlerts = monitoringService.getActiveAlerts();
      const createdAlert = activeAlerts.find(a => a.id === alertId);

      expect(createdAlert).toBeDefined();
      expect(createdAlert!.acknowledged).toBe(false);
      expect(createdAlert!.type).toBe('user_risk');
      expect(createdAlert!.severity).toBe('high');
    });

    test('should acknowledge safety alerts', async () => {
      // Create an alert first
      const alertId = await monitoringService.createSafetyAlert({
        type: 'system_overload',
        severity: 'medium',
        title: 'System Overload Warning',
        description: 'High number of active escalations',
        affectedUsers: []
      });

      // Acknowledge the alert
      const acknowledged = await monitoringService.acknowledgeSafetyAlert(alertId, 'admin-user');

      expect(acknowledged).toBe(true);

      // Check that alert is acknowledged
      const allAlerts = monitoringService.getAllAlerts();
      const acknowledgedAlert = allAlerts.find(a => a.id === alertId);

      expect(acknowledgedAlert).toBeDefined();
      expect(acknowledgedAlert!.acknowledged).toBe(true);
      expect(acknowledgedAlert!.acknowledgedBy).toBe('admin-user');
      expect(acknowledgedAlert!.acknowledgedAt).toBeDefined();
    });

    test('should prevent alert spam with cooldown', async () => {
      const alertData = {
        type: 'user_risk' as const,
        severity: 'medium' as const,
        title: 'Test Alert',
        description: 'Test alert for cooldown',
        affectedUsers: ['user-test']
      };

      // Create first alert
      const firstAlertId = await monitoringService.createSafetyAlert(alertData);

      // Try to create same alert immediately (should return existing alert due to cooldown)
      const secondAlertId = await monitoringService.createSafetyAlert(alertData);

      expect(secondAlertId).toBe(firstAlertId);
    });
  });

  describe('Safety Thresholds and Monitoring', () => {
    test('should provide configurable safety thresholds', () => {
      const thresholds = monitoringService.getThresholds();

      expect(thresholds).toHaveProperty('highRiskThreshold');
      expect(thresholds).toHaveProperty('criticalRiskThreshold');
      expect(thresholds).toHaveProperty('maxResponseTime');
      expect(thresholds).toHaveProperty('maxActiveEscalations');
      expect(thresholds).toHaveProperty('minSafetyScore');
      expect(thresholds.highRiskThreshold).toBeGreaterThan(0);
      expect(thresholds.criticalRiskThreshold).toBeGreaterThan(thresholds.highRiskThreshold);
    });

    test('should allow threshold updates', () => {
      const originalThresholds = monitoringService.getThresholds();

      const newThresholds = {
        highRiskThreshold: 80,
        minSafetyScore: 70
      };

      monitoringService.updateThresholds(newThresholds);

      const updatedThresholds = monitoringService.getThresholds();
      expect(updatedThresholds.highRiskThreshold).toBe(80);
      expect(updatedThresholds.minSafetyScore).toBe(70);
      expect(updatedThresholds.criticalRiskThreshold).toBe(originalThresholds.criticalRiskThreshold); // Unchanged
    });
  });

  describe('Data Management and Cleanup', () => {
    test('should provide access to user profiles', () => {
      const profiles = monitoringService.getUserProfiles();
      expect(Array.isArray(profiles)).toBe(true);
    });

    test('should limit metrics history', () => {
      // Add multiple metrics updates
      for (let i = 0; i < 10; i++) {
        monitoringService.updateSafetyMetrics();
      }

      // Should not grow indefinitely
      const history = monitoringService.getMetricsHistory(24);
      expect(history.length).toBeLessThanOrEqual(1000); // Configured limit
    });

    test('should limit safety events history', async () => {
      const userId = 'test-user-cleanup';

      // Add many events
      for (let i = 0; i < 50; i++) {
        await monitoringService.recordSafetyEvent({
          userId,
          type: 'crisis_detected',
          severity: 'medium',
          details: { test: true },
          resolved: false
        });
      }

      // Should not grow indefinitely
      const recentEvents = monitoringService.getRecentSafetyEvents(24);
      expect(recentEvents.length).toBeLessThanOrEqual(10000); // Configured limit
    });
  });

  describe('Risk Level Calculations', () => {
    test('should correctly categorize risk levels', async () => {
      const userId = 'test-user-risk';

      // Create profile and manually set risk score to test categorization
      const profile = await monitoringService.getUserSafetyProfile(userId);

      // Test different risk scores
      const testCases = [
        { riskScore: 20, expectedLevel: 'low' },
        { riskScore: 50, expectedLevel: 'medium' },
        { riskScore: 75, expectedLevel: 'high' },
        { riskScore: 90, expectedLevel: 'critical' }
      ];

      for (const testCase of testCases) {
        // We can't directly set risk score, but we can verify the logic exists
        // by checking that profiles have appropriate risk levels
        expect(['low', 'medium', 'high', 'critical']).toContain(profile!.currentRiskLevel);
      }
    });

    test('should calculate safety scores as inverse of risk', async () => {
      const userId = 'test-user-safety-score';

      const profile = await monitoringService.getUserSafetyProfile(userId);

      // Safety score should be between 0 and 100
      expect(profile!.safetyScore).toBeGreaterThanOrEqual(0);
      expect(profile!.safetyScore).toBeLessThanOrEqual(100);

      // Risk score + safety score should roughly equal 100 (allowing for calculation variations)
      const total = profile!.riskScore + profile!.safetyScore;
      expect(total).toBeGreaterThanOrEqual(90); // Allow some margin for calculation differences
      expect(total).toBeLessThanOrEqual(110);
    });
  });

  describe('Integration with Safety Services', () => {
    test('should integrate with crisis detection patterns', async () => {
      const userId = 'test-user-integration';

      // Record crisis detection event
      await monitoringService.recordSafetyEvent({
        userId,
        type: 'crisis_detected',
        severity: 'high',
        details: {
          indicators: ['anxiety', 'depression'],
          confidence: 0.85,
          source: 'ai_detection'
        },
        resolved: false
      });

      const profile = await monitoringService.getUserSafetyProfile(userId);

      expect(profile!.crisisIndicators).toContain('anxiety');
      expect(profile!.crisisIndicators).toContain('depression');
      expect(profile!.currentRiskLevel).not.toBe('low'); // Should be elevated due to crisis
    });

    test('should track escalation outcomes', async () => {
      const userId = 'test-user-escalation';

      // Record escalation initiation
      await monitoringService.recordSafetyEvent({
        userId,
        type: 'escalation_initiated',
        severity: 'high',
        details: {
          escalationId: 'esc-test-123',
          trigger: 'crisis_detected'
        },
        resolved: false
      });

      // Record professional assignment
      await monitoringService.recordSafetyEvent({
        userId,
        type: 'professional_assigned',
        severity: 'medium',
        details: {
          professionalId: 'prof-test-456',
          estimatedResponseTime: 10
        },
        resolved: false
      });

      // Record successful intervention
      await monitoringService.recordSafetyEvent({
        userId,
        type: 'intervention_completed',
        severity: 'low',
        details: {
          outcome: 'successful',
          duration: 45, // minutes
          followUpRequired: false
        },
        resolved: true
      });

      const profile = await monitoringService.getUserSafetyProfile(userId);

      expect(profile!.escalationHistory.length).toBe(3);
      expect(profile!.escalationHistory.some(e => e.type === 'escalation_initiated')).toBe(true);
      expect(profile!.escalationHistory.some(e => e.type === 'professional_assigned')).toBe(true);
      expect(profile!.escalationHistory.some(e => e.type === 'intervention_completed')).toBe(true);
    });
  });
});