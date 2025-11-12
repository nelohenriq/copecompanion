import { logger } from '@/lib/logger';
import { CrisisDetectionService } from './CrisisDetectionService';
import { SafetyEscalationService } from './SafetyEscalationService';

export interface SafetyMetrics {
  timestamp: Date;
  activeUsers: number;
  highRiskUsers: number;
  criticalRiskUsers: number;
  activeEscalations: number;
  pendingEscalations: number;
  resolvedEscalations: number;
  averageResponseTime: number; // in minutes
  safetyScore: number; // 0-100, higher is safer
  alertsTriggered: number;
  interventionsSuccessful: number;
}

export interface UserSafetyProfile {
  userId: string;
  currentRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  lastActivity: Date;
  sessionDuration: number; // in minutes
  crisisIndicators: string[];
  escalationHistory: SafetyEvent[];
  safetyScore: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}

export interface SafetyEvent {
  id: string;
  userId: string;
  type: 'crisis_detected' | 'escalation_initiated' | 'professional_assigned' | 'intervention_completed' | 'alert_triggered';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  details: Record<string, any>;
  resolved: boolean;
  resolutionTime?: Date;
}

export interface SafetyAlert {
  id: string;
  type: 'user_risk' | 'system_overload' | 'response_delay' | 'trend_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedUsers: string[];
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  autoResolved: boolean;
  resolutionDetails?: string;
}

export interface SafetyThresholds {
  highRiskThreshold: number;
  criticalRiskThreshold: number;
  maxResponseTime: number; // minutes
  maxActiveEscalations: number;
  minSafetyScore: number;
  alertCooldownPeriod: number; // minutes
}

export class SafetyMonitoringService {
  private metrics: SafetyMetrics[] = [];
  private userProfiles: Map<string, UserSafetyProfile> = new Map();
  private safetyEvents: SafetyEvent[] = [];
  private activeAlerts: SafetyAlert[] = [];
  private thresholds: SafetyThresholds;
  private crisisService: CrisisDetectionService;
  private escalationService: SafetyEscalationService;

  constructor(
    crisisService?: CrisisDetectionService,
    escalationService?: SafetyEscalationService
  ) {
    this.crisisService = crisisService || new CrisisDetectionService();
    this.escalationService = escalationService || new SafetyEscalationService();

    this.thresholds = {
      highRiskThreshold: 70,
      criticalRiskThreshold: 85,
      maxResponseTime: 15, // minutes
      maxActiveEscalations: 50,
      minSafetyScore: 60,
      alertCooldownPeriod: 30 // minutes
    };

    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    // Start real-time monitoring
    setInterval(() => {
      this.updateSafetyMetrics();
      this.checkSafetyThresholds();
    }, 5000); // Update every 5 seconds

    // Clean up old data periodically
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Clean up every hour

    logger.info({
      updateInterval: 5000,
      cleanupInterval: 3600000,
      thresholds: this.thresholds
    }, 'Safety monitoring service initialized');
  }

  async updateSafetyMetrics(): Promise<SafetyMetrics> {
    try {
      const now = new Date();

      // Get current system state
      const activeUsers = await this.getActiveUserCount();
      const highRiskUsers = await this.getHighRiskUserCount();
      const criticalRiskUsers = await this.getCriticalRiskUserCount();
      const escalationStats = await this.getEscalationStats();
      const responseTimeStats = await this.getResponseTimeStats();
      const alertStats = await this.getAlertStats();

      // Calculate safety score (inverse of risk)
      const totalUsers = Math.max(activeUsers, 1);
      const riskPercentage = (highRiskUsers + criticalRiskUsers * 2) / totalUsers;
      const escalationLoad = escalationStats.active / Math.max(this.thresholds.maxActiveEscalations, 1);
      const responseTimePenalty = Math.max(0, responseTimeStats.average - this.thresholds.maxResponseTime) / this.thresholds.maxResponseTime;

      const safetyScore = Math.max(0, Math.min(100,
        100 - (riskPercentage * 30) - (escalationLoad * 20) - (responseTimePenalty * 20) - (alertStats.unacknowledged * 10)
      ));

      const currentMetrics: SafetyMetrics = {
        timestamp: now,
        activeUsers,
        highRiskUsers,
        criticalRiskUsers,
        activeEscalations: escalationStats.active,
        pendingEscalations: escalationStats.pending,
        resolvedEscalations: escalationStats.resolved,
        averageResponseTime: responseTimeStats.average,
        safetyScore: Math.round(safetyScore),
        alertsTriggered: alertStats.total,
        interventionsSuccessful: escalationStats.successful
      };

      this.metrics.push(currentMetrics);

      // Keep only last 1000 metrics entries
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      logger.debug({
        activeUsers,
        highRiskUsers,
        criticalRiskUsers,
        safetyScore: currentMetrics.safetyScore,
        activeEscalations: escalationStats.active
      }, 'Safety metrics updated');

      return currentMetrics;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update safety metrics');

      throw error;
    }
  }

  async getUserSafetyProfile(userId: string): Promise<UserSafetyProfile | null> {
    try {
      let profile = this.userProfiles.get(userId);

      if (!profile) {
        // Create new profile for user
        profile = await this.createUserSafetyProfile(userId);
        this.userProfiles.set(userId, profile);
      }

      // Update profile with latest data
      await this.updateUserSafetyProfile(profile);

      return profile;

    } catch (error) {
      logger.error({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get user safety profile');

      return null;
    }
  }

  private async createUserSafetyProfile(userId: string): Promise<UserSafetyProfile> {
    const profile: UserSafetyProfile = {
      userId,
      currentRiskLevel: 'low',
      riskScore: 10, // Start with low risk
      lastActivity: new Date(),
      sessionDuration: 0,
      crisisIndicators: [],
      escalationHistory: [],
      safetyScore: 90, // Start with high safety score
      trend: 'stable',
      lastUpdated: new Date()
    };

    return profile;
  }

  private async updateUserSafetyProfile(profile: UserSafetyProfile): Promise<void> {
    try {
      // Get recent safety events for this user to calculate risk
      const recentEvents = this.safetyEvents.filter(
        event => event.userId === profile.userId &&
        event.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      );

      // Calculate risk score based on recent safety events
      let riskScore = 10; // Base low risk

      if (recentEvents.length > 0) {
        // Calculate risk based on event severity and recency
        const severityWeights = { low: 1, medium: 2, high: 3, critical: 5 };
        const totalWeight = recentEvents.reduce((sum, event) => {
          const weight = severityWeights[event.severity] || 1;
          const hoursAgo = (Date.now() - event.timestamp.getTime()) / (60 * 60 * 1000);
          const recencyMultiplier = Math.max(0.1, 1 - (hoursAgo / 24)); // Recent events have higher weight
          return sum + (weight * recencyMultiplier);
        }, 0);

        riskScore = Math.min(100, (totalWeight / recentEvents.length) * 20);
      }

      // Get escalation history
      const escalationHistory = this.safetyEvents.filter(
        event => event.userId === profile.userId &&
        ['crisis_detected', 'escalation_initiated', 'intervention_completed'].includes(event.type)
      );

      // Calculate safety score (inverse of risk)
      const safetyScore = Math.max(0, 100 - riskScore);

      // Determine trend based on recent history
      const trend = this.calculateSafetyTrend(profile, safetyScore);

      // Update profile
      profile.currentRiskLevel = this.getRiskLevel(riskScore);
      profile.riskScore = riskScore;
      profile.crisisIndicators = recentEvents
        .filter(e => e.type === 'crisis_detected')
        .flatMap(e => e.details?.indicators || []);
      profile.escalationHistory = escalationHistory.slice(-10); // Keep last 10 events
      profile.safetyScore = safetyScore;
      profile.trend = trend;
      profile.lastUpdated = new Date();

    } catch (error) {
      logger.error({
        userId: profile.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update user safety profile');
    }
  }

  private calculateSafetyTrend(profile: UserSafetyProfile, currentSafetyScore: number): 'improving' | 'stable' | 'declining' {
    const previousScore = profile.safetyScore;

    if (currentSafetyScore > previousScore + 5) return 'improving';
    if (currentSafetyScore < previousScore - 5) return 'declining';
    return 'stable';
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= this.thresholds.criticalRiskThreshold) return 'critical';
    if (riskScore >= this.thresholds.highRiskThreshold) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  async recordSafetyEvent(event: Omit<SafetyEvent, 'id' | 'timestamp'>): Promise<string> {
    try {
      const eventId = `safety-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const safetyEvent: SafetyEvent = {
        ...event,
        id: eventId,
        timestamp: new Date()
      };

      this.safetyEvents.push(safetyEvent);

      // Keep only last 10000 events
      if (this.safetyEvents.length > 10000) {
        this.safetyEvents = this.safetyEvents.slice(-10000);
      }

      // Update user profile if this affects a user
      if (event.userId) {
        const profile = this.userProfiles.get(event.userId);
        if (profile) {
          await this.updateUserSafetyProfile(profile);
        }
      }

      logger.info({
        eventId,
        userId: event.userId,
        type: event.type,
        severity: event.severity
      }, 'Safety event recorded');

      return eventId;

    } catch (error) {
      logger.error({
        userId: event.userId,
        type: event.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to record safety event');

      throw error;
    }
  }

  async createSafetyAlert(alert: Omit<SafetyAlert, 'id' | 'triggeredAt' | 'acknowledged' | 'autoResolved'>): Promise<string> {
    try {
      // Check for alert cooldown to prevent spam
      const recentAlert = this.activeAlerts.find(
        a => a.type === alert.type &&
        a.affectedUsers.some(u => alert.affectedUsers.includes(u)) &&
        (Date.now() - a.triggeredAt.getTime()) < (this.thresholds.alertCooldownPeriod * 60 * 1000)
      );

      if (recentAlert) {
        logger.debug({
          alertType: alert.type,
          affectedUsers: alert.affectedUsers,
          cooldownRemaining: Math.round((this.thresholds.alertCooldownPeriod * 60 * 1000 - (Date.now() - recentAlert.triggeredAt.getTime())) / 1000)
        }, 'Alert suppressed due to cooldown period');

        return recentAlert.id;
      }

      const alertId = `safety-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const safetyAlert: SafetyAlert = {
        ...alert,
        id: alertId,
        triggeredAt: new Date(),
        acknowledged: false,
        autoResolved: false
      };

      this.activeAlerts.push(safetyAlert);

      logger.warn({
        alertId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        affectedUsersCount: alert.affectedUsers.length
      }, 'Safety alert created');

      return alertId;

    } catch (error) {
      logger.error({
        alertType: alert.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to create safety alert');

      throw error;
    }
  }

  async acknowledgeSafetyAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    try {
      const alert = this.activeAlerts.find(a => a.id === alertId);

      if (!alert) {
        return false;
      }

      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();

      logger.info({
        alertId,
        acknowledgedBy,
        alertType: alert.type,
        severity: alert.severity
      }, 'Safety alert acknowledged');

      return true;

    } catch (error) {
      logger.error({
        alertId,
        acknowledgedBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to acknowledge safety alert');

      return false;
    }
  }

  private async checkSafetyThresholds(): Promise<void> {
    try {
      const currentMetrics = this.metrics[this.metrics.length - 1];
      if (!currentMetrics) return;

      // Check for high number of high-risk users
      if (currentMetrics.highRiskUsers > currentMetrics.activeUsers * 0.1) { // 10% of active users
        await this.createSafetyAlert({
          type: 'user_risk',
          severity: 'high',
          title: 'High Number of High-Risk Users',
          description: `${currentMetrics.highRiskUsers} users currently at high risk (${Math.round(currentMetrics.highRiskUsers / currentMetrics.activeUsers * 100)}% of active users)`,
          affectedUsers: [] // Would need to query actual user IDs
        });
      }

      // Check for critical risk users
      if (currentMetrics.criticalRiskUsers > 0) {
        await this.createSafetyAlert({
          type: 'user_risk',
          severity: 'critical',
          title: 'Critical Risk Users Detected',
          description: `${currentMetrics.criticalRiskUsers} users currently at critical risk requiring immediate attention`,
          affectedUsers: [] // Would need to query actual user IDs
        });
      }

      // Check for system overload
      if (currentMetrics.activeEscalations > this.thresholds.maxActiveEscalations) {
        await this.createSafetyAlert({
          type: 'system_overload',
          severity: 'high',
          title: 'System Overload - High Escalation Volume',
          description: `${currentMetrics.activeEscalations} active escalations exceed threshold of ${this.thresholds.maxActiveEscalations}`,
          affectedUsers: []
        });
      }

      // Check for slow response times
      if (currentMetrics.averageResponseTime > this.thresholds.maxResponseTime) {
        await this.createSafetyAlert({
          type: 'response_delay',
          severity: 'medium',
          title: 'Slow Professional Response Times',
          description: `Average response time of ${currentMetrics.averageResponseTime.toFixed(1)} minutes exceeds threshold of ${this.thresholds.maxResponseTime} minutes`,
          affectedUsers: []
        });
      }

      // Check for low safety score
      if (currentMetrics.safetyScore < this.thresholds.minSafetyScore) {
        await this.createSafetyAlert({
          type: 'trend_anomaly',
          severity: 'medium',
          title: 'Low Overall Safety Score',
          description: `Platform safety score of ${currentMetrics.safetyScore} is below minimum threshold of ${this.thresholds.minSafetyScore}`,
          affectedUsers: []
        });
      }

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to check safety thresholds');
    }
  }

  private async getActiveUserCount(): Promise<number> {
    // This would query the actual user session data
    // For now, return a mock value
    return Math.floor(Math.random() * 1000) + 100; // 100-1100 users
  }

  private async getHighRiskUserCount(): Promise<number> {
    // This would query users with risk scores above threshold
    // For now, return a mock value
    return Math.floor(Math.random() * 50) + 5; // 5-55 high risk users
  }

  private async getCriticalRiskUserCount(): Promise<number> {
    // This would query users with critical risk scores
    // For now, return a mock value
    return Math.floor(Math.random() * 10); // 0-10 critical risk users
  }

  private async getEscalationStats(): Promise<{
    active: number;
    pending: number;
    resolved: number;
    successful: number;
  }> {
    // This would query the escalation service
    // For now, return mock values
    return {
      active: Math.floor(Math.random() * 20) + 5, // 5-25 active
      pending: Math.floor(Math.random() * 10) + 2, // 2-12 pending
      resolved: Math.floor(Math.random() * 50) + 20, // 20-70 resolved today
      successful: Math.floor(Math.random() * 40) + 15 // 15-55 successful
    };
  }

  private async getResponseTimeStats(): Promise<{ average: number }> {
    // This would calculate average response times from escalation data
    // For now, return a mock value
    return {
      average: Math.random() * 20 + 5 // 5-25 minutes
    };
  }

  private async getAlertStats(): Promise<{ total: number; unacknowledged: number }> {
    const total = this.activeAlerts.length;
    const unacknowledged = this.activeAlerts.filter(a => !a.acknowledged).length;

    return { total, unacknowledged };
  }

  private cleanupOldData(): void {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Clean up old metrics (keep last 24 hours)
      this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);

      // Clean up old safety events (keep last week)
      this.safetyEvents = this.safetyEvents.filter(e => e.timestamp > oneWeekAgo);

      // Clean up resolved alerts older than 1 day
      this.activeAlerts = this.activeAlerts.filter(a =>
        !a.acknowledged || a.acknowledgedAt! > oneDayAgo
      );

      // Clean up old user profiles (keep active ones)
      for (const [userId, profile] of this.userProfiles) {
        if (profile.lastActivity < oneWeekAgo) {
          this.userProfiles.delete(userId);
        }
      }

      logger.debug({
        metricsKept: this.metrics.length,
        eventsKept: this.safetyEvents.length,
        alertsKept: this.activeAlerts.length,
        profilesKept: this.userProfiles.size
      }, 'Old safety monitoring data cleaned up');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to cleanup old safety monitoring data');
    }
  }

  // Public getters for dashboard access
  getCurrentMetrics(): SafetyMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(hours: number = 24): SafetyMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  getActiveAlerts(): SafetyAlert[] {
    return this.activeAlerts.filter(a => !a.acknowledged);
  }

  getAllAlerts(): SafetyAlert[] {
    return [...this.activeAlerts];
  }

  getRecentSafetyEvents(hours: number = 1): SafetyEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.safetyEvents.filter(e => e.timestamp > cutoff);
  }

  getUserProfiles(): UserSafetyProfile[] {
    return Array.from(this.userProfiles.values());
  }

  updateThresholds(newThresholds: Partial<SafetyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };

    logger.info({
      updatedThresholds: newThresholds
    }, 'Safety monitoring thresholds updated');
  }

  getThresholds(): SafetyThresholds {
    return { ...this.thresholds };
  }
}