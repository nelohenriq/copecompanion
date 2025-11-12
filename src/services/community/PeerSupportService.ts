import { CommunityService, UserProfile, UserConnection, PeerSupportSession } from './CommunityService';
import { logger } from '@/lib/logger';

export interface SupportMatch {
  userId: string;
  matchedUserId: string;
  matchScore: number;
  matchReasons: string[];
  compatibilityFactors: {
    sharedExperiences: number;
    emotionalCompatibility: number;
    availabilityOverlap: number;
    communicationStyle: number;
    supportPreferences: number;
  };
  recommendedSessionType: 'one-on-one' | 'group' | 'crisis_support';
  confidence: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface CrisisSupportRequest {
  id: string;
  userId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  crisisType: string;
  description: string;
  immediateNeeds: string[];
  preferredSupportType: 'chat' | 'call' | 'in-person' | 'professional';
  location?: {
    type: 'virtual' | 'physical';
    details?: string;
  };
  createdAt: Date;
  status: 'pending' | 'matched' | 'resolved' | 'escalated';
  assignedSupporters: string[];
  responseTime?: number; // minutes
  resolutionTime?: number;
  outcome: string;
}

export interface SupportNetwork {
  userId: string;
  networkType: 'personal' | 'community' | 'professional';
  connections: {
    connectionId: string;
    userId: string;
    relationshipType: string;
    trustLevel: number;
    lastInteraction: Date;
    interactionFrequency: number;
    supportAreas: string[];
  }[];
  networkStrength: number;
  diversityScore: number;
  lastUpdated: Date;
}

export interface PeerSupportMetrics {
  userId: string;
  totalSessions: number;
  successfulSessions: number;
  averageRating: number;
  responseTime: number; // average minutes
  topicsSupported: string[];
  skillsDemonstrated: string[];
  growthAreas: string[];
  certifications: string[];
  lastActivity: Date;
  reputation: number; // 0-1 scale
}

export interface SupportSessionFeedback {
  sessionId: string;
  giverId: string;
  receiverId: string;
  rating: number; // 1-5
  categories: {
    empathy: number;
    helpfulness: number;
    activeListening: number;
    appropriateAdvice: number;
    safety: number;
  };
  comments?: string;
  wouldRecommend: boolean;
  createdAt: Date;
}

export interface CrisisIntervention {
  id: string;
  requestId: string;
  interventionType: 'peer_support' | 'professional_referral' | 'crisis_hotline' | 'emergency_services';
  priority: 'low' | 'medium' | 'high' | 'critical';
  actions: {
    type: string;
    description: string;
    completed: boolean;
    completedAt?: Date;
    outcome?: string;
  }[];
  involvedParties: string[];
  startedAt: Date;
  resolvedAt?: Date;
  effectiveness: number; // 1-5
  followUpRequired: boolean;
  followUpScheduled?: Date;
}

export class PeerSupportService {
  private communityService: CommunityService;
  private supportMatches: Map<string, SupportMatch[]> = new Map();
  private crisisRequests: Map<string, CrisisSupportRequest> = new Map();
  private supportNetworks: Map<string, SupportNetwork> = new Map();
  private peerMetrics: Map<string, PeerSupportMetrics> = new Map();
  private sessionFeedback: Map<string, SupportSessionFeedback[]> = new Map();
  private interventions: Map<string, CrisisIntervention> = new Map();

  constructor(communityService: CommunityService) {
    this.communityService = communityService;
    this.initializePeerSupport();
  }

  private initializePeerSupport() {
    // Initialize peer support matching algorithms and crisis protocols
    logger.info('Peer support service initialized');
  }

  async findSupportMatches(userId: string, criteria?: {
    supportType?: string;
    urgency?: 'low' | 'medium' | 'high';
    topics?: string[];
    maxMatches?: number;
  }): Promise<SupportMatch[]> {
    try {
      const userProfile = this.communityService.getUserProfile(userId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const potentialMatches = await this.findPotentialSupporters(userId, criteria);
      const matches: SupportMatch[] = [];

      for (const supporter of potentialMatches) {
        const match = await this.calculateSupportMatch(userId, supporter.userId, criteria);
        if (match.matchScore > 0.6) { // Minimum match threshold
          matches.push(match);
        }
      }

      // Sort by match score and limit results
      matches.sort((a, b) => b.matchScore - a.matchScore);
      const maxMatches = criteria?.maxMatches || 5;
      const topMatches = matches.slice(0, maxMatches);

      // Cache matches for 24 hours
      this.supportMatches.set(userId, topMatches.map(m => ({
        ...m,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })));

      logger.info({
        userId,
        matchesFound: topMatches.length,
        avgMatchScore: topMatches.length > 0
          ? topMatches.reduce((sum, m) => sum + m.matchScore, 0) / topMatches.length
          : 0
      }, 'Support matches found');

      return topMatches;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to find support matches');
      return [];
    }
  }

  private async findPotentialSupporters(userId: string, criteria?: any): Promise<UserProfile[]> {
    // Get all users who have indicated they're willing to provide peer support
    // In a real implementation, this would query the database
    const allUsers = Array.from(this.communityService['users'].values())
      .filter(u => u.userId !== userId && u.isActive);

    // Filter by criteria
    let supporters = allUsers.filter(u =>
      u.supportAreas && u.supportAreas.length > 0
    );

    if (criteria?.topics) {
      supporters = supporters.filter(u =>
        criteria.topics.some((topic: string) => u.supportAreas.includes(topic))
      );
    }

    return supporters;
  }

  private async calculateSupportMatch(
    seekerId: string,
    supporterId: string,
    criteria?: any
  ): Promise<SupportMatch> {
    const seekerProfile = this.communityService.getUserProfile(seekerId);
    const supporterProfile = this.communityService.getUserProfile(supporterId);

    if (!seekerProfile || !supporterProfile) {
      throw new Error('User profile not found');
    }

    // Calculate compatibility factors
    const sharedExperiences = this.calculateSharedExperiences(seekerProfile, supporterProfile);
    const emotionalCompatibility = this.calculateEmotionalCompatibility(seekerProfile, supporterProfile);
    const availabilityOverlap = this.calculateAvailabilityOverlap(seekerId, supporterId);
    const communicationStyle = this.calculateCommunicationStyle(seekerProfile, supporterProfile);
    const supportPreferences = this.calculateSupportPreferences(seekerProfile, supporterProfile, criteria);

    // Weighted combination
    const matchScore = (
      sharedExperiences * 0.25 +
      emotionalCompatibility * 0.25 +
      availabilityOverlap * 0.20 +
      communicationStyle * 0.15 +
      supportPreferences * 0.15
    );

    const matchReasons = this.generateMatchReasons({
      sharedExperiences,
      emotionalCompatibility,
      availabilityOverlap,
      communicationStyle,
      supportPreferences
    });

    const recommendedSessionType = this.determineSessionType(matchScore, criteria?.urgency);

    return {
      userId: seekerId,
      matchedUserId: supporterId,
      matchScore,
      matchReasons,
      compatibilityFactors: {
        sharedExperiences,
        emotionalCompatibility,
        availabilityOverlap,
        communicationStyle,
        supportPreferences
      },
      recommendedSessionType,
      confidence: Math.min(matchScore + 0.1, 0.95), // Add small confidence boost
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  private calculateSharedExperiences(seeker: UserProfile, supporter: UserProfile): number {
    const seekerInterests = new Set(seeker.interests);
    const supporterInterests = new Set(supporter.interests);

    const intersection = new Set([...seekerInterests].filter(x => supporterInterests.has(x)));
    const union = new Set([...seekerInterests, ...supporterInterests]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateEmotionalCompatibility(seeker: UserProfile, supporter: UserProfile): number {
    // Simplified emotional compatibility calculation
    // In production, this would use more sophisticated matching
    const seekerSupportAreas = new Set(seeker.supportAreas);
    const supporterSupportAreas = new Set(supporter.supportAreas);

    const intersection = new Set([...seekerSupportAreas].filter(x => supporterSupportAreas.has(x)));
    const union = new Set([...seekerSupportAreas, ...supporterSupportAreas]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateAvailabilityOverlap(seekerId: string, supporterId: string): number {
    // Simplified availability calculation
    // In production, this would check actual schedules
    return 0.7; // Assume 70% overlap as default
  }

  private calculateCommunicationStyle(seeker: UserProfile, supporter: UserProfile): number {
    // Simplified communication style matching
    // In production, this would analyze communication patterns
    return 0.8; // Assume good communication compatibility
  }

  private calculateSupportPreferences(
    seeker: UserProfile,
    supporter: UserProfile,
    criteria?: any
  ): number {
    if (!criteria?.supportType) return 0.5;

    const supporterCanProvide = supporter.supportAreas.includes(criteria.supportType);
    return supporterCanProvide ? 0.9 : 0.1;
  }

  private generateMatchReasons(factors: any): string[] {
    const reasons = [];

    if (factors.sharedExperiences > 0.7) {
      reasons.push('Shared interests and experiences');
    }
    if (factors.emotionalCompatibility > 0.7) {
      reasons.push('Compatible support areas');
    }
    if (factors.availabilityOverlap > 0.7) {
      reasons.push('Good availability overlap');
    }
    if (factors.communicationStyle > 0.7) {
      reasons.push('Similar communication styles');
    }
    if (factors.supportPreferences > 0.8) {
      reasons.push('Matches your specific support needs');
    }

    return reasons.length > 0 ? reasons : ['General compatibility'];
  }

  private determineSessionType(matchScore: number, urgency?: string): 'one-on-one' | 'group' | 'crisis_support' {
    if (urgency === 'high') return 'crisis_support';
    if (matchScore > 0.8) return 'one-on-one';
    return 'group';
  }

  async createCrisisSupportRequest(requestData: Omit<CrisisSupportRequest, 'id' | 'createdAt' | 'status' | 'assignedSupporters' | 'outcome'>): Promise<CrisisSupportRequest> {
    try {
      const request: CrisisSupportRequest = {
        ...requestData,
        id: this.generateCrisisId(),
        createdAt: new Date(),
        status: 'pending',
        assignedSupporters: [],
        outcome: 'pending'
      };

      this.crisisRequests.set(request.id, request);

      // Trigger immediate crisis response
      await this.handleCrisisRequest(request);

      logger.warn({
        requestId: request.id,
        userId: request.userId,
        severity: request.severity,
        crisisType: request.crisisType
      }, 'Crisis support request created');

      return request;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: requestData.userId
      }, 'Failed to create crisis support request');
      throw error;
    }
  }

  private async handleCrisisRequest(request: CrisisSupportRequest): Promise<void> {
    // Immediate crisis response protocol
    const intervention: CrisisIntervention = {
      id: this.generateInterventionId(),
      requestId: request.id,
      interventionType: this.determineInterventionType(request),
      priority: request.severity,
      actions: [],
      involvedParties: [request.userId],
      startedAt: new Date(),
      effectiveness: 0, // Will be updated when resolved
      followUpRequired: true
    };

    // Add initial actions based on severity
    if (request.severity === 'critical') {
      intervention.actions.push({
        type: 'emergency_services',
        description: 'Contact emergency services immediately',
        completed: false
      });
      intervention.actions.push({
        type: 'professional_referral',
        description: 'Connect with mental health professional',
        completed: false
      });
    } else if (request.severity === 'high') {
      intervention.actions.push({
        type: 'peer_support',
        description: 'Find immediate peer support match',
        completed: false
      });
      intervention.actions.push({
        type: 'crisis_hotline',
        description: 'Provide crisis hotline information',
        completed: false
      });
    } else {
      intervention.actions.push({
        type: 'peer_support',
        description: 'Match with appropriate peer supporter',
        completed: false
      });
    }

    this.interventions.set(intervention.id, intervention);

    // Find and assign supporters
    const matches = await this.findSupportMatches(request.userId, {
      urgency: request.severity === 'critical' ? 'high' : request.severity,
      topics: [request.crisisType],
      maxMatches: request.severity === 'critical' ? 3 : 1
    });

    if (matches.length > 0) {
      request.assignedSupporters = matches.map(m => m.matchedUserId);
      request.status = 'matched';
      this.crisisRequests.set(request.id, request);
    }
  }

  private determineInterventionType(request: CrisisSupportRequest): CrisisIntervention['interventionType'] {
    if (request.severity === 'critical') {
      return request.preferredSupportType === 'professional' ? 'professional_referral' : 'emergency_services';
    }
    if (request.severity === 'high') {
      return 'crisis_hotline';
    }
    return 'peer_support';
  }

  async submitSessionFeedback(feedback: Omit<SupportSessionFeedback, 'createdAt'>): Promise<SupportSessionFeedback> {
    try {
      const sessionFeedback: SupportSessionFeedback = {
        ...feedback,
        createdAt: new Date()
      };

      const sessionFeedbacks = this.sessionFeedback.get(feedback.sessionId) || [];
      sessionFeedbacks.push(sessionFeedback);
      this.sessionFeedback.set(feedback.sessionId, sessionFeedbacks);

      // Update peer support metrics
      await this.updatePeerMetrics(feedback.giverId, sessionFeedback);

      logger.info({
        sessionId: feedback.sessionId,
        giverId: feedback.giverId,
        receiverId: feedback.receiverId,
        rating: feedback.rating
      }, 'Session feedback submitted');

      return sessionFeedback;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: feedback.sessionId
      }, 'Failed to submit session feedback');
      throw error;
    }
  }

  private async updatePeerMetrics(giverId: string, feedback: SupportSessionFeedback): Promise<void> {
    const metrics = this.peerMetrics.get(giverId) || {
      userId: giverId,
      totalSessions: 0,
      successfulSessions: 0,
      averageRating: 0,
      responseTime: 0,
      topicsSupported: [],
      skillsDemonstrated: [],
      growthAreas: [],
      certifications: [],
      lastActivity: new Date(),
      reputation: 0.5
    };

    // Update metrics
    metrics.totalSessions += 1;
    if (feedback.rating >= 4) {
      metrics.successfulSessions += 1;
    }

    // Recalculate average rating
    const allFeedback = this.sessionFeedback.get(feedback.sessionId) || [];
    const giverFeedback = allFeedback.filter(f => f.giverId === giverId);
    metrics.averageRating = giverFeedback.reduce((sum, f) => sum + f.rating, 0) / giverFeedback.length;

    metrics.lastActivity = new Date();

    // Update reputation (simplified algorithm)
    metrics.reputation = Math.min(
      (metrics.averageRating / 5) * 0.7 +
      (metrics.successfulSessions / metrics.totalSessions) * 0.3,
      1.0
    );

    this.peerMetrics.set(giverId, metrics);
  }

  async buildSupportNetwork(userId: string): Promise<SupportNetwork> {
    try {
      const connections = this.communityService.getUserConnections(userId);
      const userProfile = this.communityService.getUserProfile(userId);

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const networkConnections = connections
        .filter(c => c.status === 'accepted')
        .map(connection => ({
          connectionId: connection.id,
          userId: connection.connectedUserId,
          relationshipType: connection.connectionType,
          trustLevel: connection.trustLevel,
          lastInteraction: connection.lastInteraction || connection.createdAt,
          interactionFrequency: this.calculateInteractionFrequency(connection),
          supportAreas: this.getConnectionSupportAreas(connection)
        }));

      const networkStrength = this.calculateNetworkStrength(networkConnections);
      const diversityScore = this.calculateNetworkDiversity(networkConnections);

      const network: SupportNetwork = {
        userId,
        networkType: 'personal',
        connections: networkConnections,
        networkStrength,
        diversityScore,
        lastUpdated: new Date()
      };

      this.supportNetworks.set(userId, network);

      logger.debug({
        userId,
        connectionsCount: networkConnections.length,
        networkStrength,
        diversityScore
      }, 'Support network built');

      return network;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to build support network');
      throw error;
    }
  }

  private calculateInteractionFrequency(connection: UserConnection): number {
    // Simplified frequency calculation
    // In production, this would analyze actual interaction history
    const daysSinceLastInteraction = connection.lastInteraction
      ? (Date.now() - connection.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
      : 30;

    if (daysSinceLastInteraction < 1) return 1.0; // Daily
    if (daysSinceLastInteraction < 7) return 0.7; // Weekly
    if (daysSinceLastInteraction < 30) return 0.3; // Monthly
    return 0.1; // Rarely
  }

  private getConnectionSupportAreas(connection: UserConnection): string[] {
    // Get support areas from connected user's profile
    const connectedProfile = this.communityService.getUserProfile(connection.connectedUserId);
    return connectedProfile?.supportAreas || [];
  }

  private calculateNetworkStrength(connections: SupportNetwork['connections']): number {
    if (connections.length === 0) return 0;

    const avgTrust = connections.reduce((sum, c) => sum + c.trustLevel, 0) / connections.length;
    const avgFrequency = connections.reduce((sum, c) => sum + c.interactionFrequency, 0) / connections.length;
    const sizeFactor = Math.min(connections.length / 10, 1); // Cap at 10 connections

    return (avgTrust * 0.4 + avgFrequency * 0.4 + sizeFactor * 0.2);
  }

  private calculateNetworkDiversity(connections: SupportNetwork['connections']): number {
    if (connections.length === 0) return 0;

    const relationshipTypes = new Set(connections.map(c => c.relationshipType));
    const supportAreas = new Set(connections.flatMap(c => c.supportAreas));

    const typeDiversity = relationshipTypes.size / 4; // Max 4 relationship types
    const areaDiversity = supportAreas.size / 10; // Max 10 support areas

    return Math.min((typeDiversity + areaDiversity) / 2, 1.0);
  }

  // Utility methods
  private generateCrisisId(): string {
    return `crisis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInterventionId(): string {
    return `intervention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Data access methods
  getSupportMatches(userId: string): SupportMatch[] {
    const matches = this.supportMatches.get(userId) || [];
    return matches.filter(m => m.expiresAt > new Date());
  }

  getCrisisRequest(requestId: string): CrisisSupportRequest | null {
    return this.crisisRequests.get(requestId) || null;
  }

  getSupportNetwork(userId: string): SupportNetwork | null {
    return this.supportNetworks.get(userId) || null;
  }

  getPeerMetrics(userId: string): PeerSupportMetrics | null {
    return this.peerMetrics.get(userId) || null;
  }

  getSessionFeedback(sessionId: string): SupportSessionFeedback[] {
    return this.sessionFeedback.get(sessionId) || [];
  }

  // Analytics methods
  getPeerSupportStats(): {
    totalUsers: number;
    activeSupporters: number;
    totalSessions: number;
    avgResponseTime: number;
    crisisResolutionRate: number;
    avgSatisfaction: number;
  } {
    const totalUsers = this.communityService.getCommunityStats().totalUsers;
    const activeSupporters = Array.from(this.peerMetrics.values())
      .filter(m => (Date.now() - m.lastActivity.getTime()) < 30 * 24 * 60 * 60 * 1000).length;

    const totalSessions = Array.from(this.peerMetrics.values())
      .reduce((sum, m) => sum + m.totalSessions, 0);

    const avgResponseTime = 15; // Mock value in minutes
    const crisisResolutionRate = 0.85; // Mock value
    const avgSatisfaction = Array.from(this.sessionFeedback.values())
      .flat()
      .reduce((sum, f) => sum + f.rating, 0) /
      Math.max(Array.from(this.sessionFeedback.values()).flat().length, 1);

    return {
      totalUsers,
      activeSupporters,
      totalSessions,
      avgResponseTime,
      crisisResolutionRate,
      avgSatisfaction
    };
  }
}