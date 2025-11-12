import { AiService } from '../ai/AiService';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

export interface CrisisIndicator {
  level: 'low' | 'medium' | 'high';
  score: number;
  keywords: string[];
  categories: string[];
  confidence: number;
}

export interface CrisisAssessment {
  conversationId: string;
  userId: string;
  riskLevel: 'low' | 'medium' | 'high';
  indicators: CrisisIndicator[];
  overallScore: number;
  recommendedActions: string[];
  flaggedAt: Date;
  reviewed: boolean;
  escalated: boolean;
}

export interface CrisisDetectionConfig {
  enabled: boolean;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  analysisFrequency: 'realtime' | 'batch';
  aiModel?: string;
  alertChannels: ('email' | 'sms' | 'inapp')[];
}

export class CrisisDetectionService {
  private aiService: AiService;
  private config: CrisisDetectionConfig;

  constructor(aiService: AiService, config: CrisisDetectionConfig) {
    this.aiService = aiService;
    this.config = config;
  }

  /**
   * Analyze a message for crisis indicators
   */
  async analyzeMessage(
    message: string,
    conversationId: string,
    userId: string,
    context?: string[]
  ): Promise<CrisisAssessment | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      logger.info({
        conversationId,
        userId,
        messageLength: message.length
      }, 'Analyzing message for crisis indicators');

      // Perform multi-layered analysis
      const indicators = await this.performAnalysis(message, context);

      if (indicators.length === 0) {
        return null; // No crisis indicators found
      }

      // Calculate overall risk score
      const overallScore = this.calculateOverallScore(indicators);
      const riskLevel = this.determineRiskLevel(overallScore);

      // Only flag if above minimum threshold
      if (overallScore < this.config.riskThresholds.low) {
        return null;
      }

      const assessment: CrisisAssessment = {
        conversationId,
        userId,
        riskLevel,
        indicators,
        overallScore,
        recommendedActions: this.generateRecommendedActions(riskLevel, indicators),
        flaggedAt: new Date(),
        reviewed: false,
        escalated: false,
      };

      // Store assessment in database
      await this.storeAssessment(assessment);

      // Trigger alerts if high risk
      if (riskLevel === 'high' || riskLevel === 'medium') {
        await this.triggerAlerts(assessment);
      }

      logger.warn({
        conversationId,
        userId,
        riskLevel,
        overallScore,
        indicatorCount: indicators.length
      }, 'Crisis indicators detected');

      return assessment;

    } catch (error) {
      logger.error({
        conversationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Crisis detection analysis failed');

      return null;
    }
  }

  /**
   * Analyze conversation history for patterns
   */
  async analyzeConversationHistory(conversationId: string): Promise<CrisisAssessment | null> {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { timestamp: 'desc' },
        take: 20, // Analyze last 20 messages
      });

      if (messages.length === 0) {
        return null;
      }

      const conversationText = messages
        .reverse() // Put in chronological order
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Get user ID from conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });

      if (!conversation) {
        return null;
      }

      return this.analyzeMessage(
        conversationText,
        conversationId,
        conversation.userId,
        messages.map(m => m.content)
      );

    } catch (error) {
      logger.error({
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Conversation history analysis failed');

      return null;
    }
  }

  /**
   * Get crisis assessments for review
   */
  async getAssessmentsForReview(
    status: 'unreviewed' | 'reviewed' | 'escalated' = 'unreviewed',
    limit: number = 50
  ): Promise<CrisisAssessment[]> {
    try {
      const where: any = {};
      if (status === 'unreviewed') {
        where.reviewed = false;
      } else if (status === 'escalated') {
        where.escalated = true;
      }

      const assessments = await prisma.crisisAssessment.findMany({
        where,
        orderBy: { flaggedAt: 'desc' },
        take: limit,
        include: {
          conversation: {
            include: {
              messages: {
                orderBy: { timestamp: 'desc' },
                take: 5,
              },
            },
          },
        },
      });

      return assessments.map(this.formatAssessmentFromDb);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get assessments for review');

      return [];
    }
  }

  /**
   * Mark assessment as reviewed
   */
  async markAsReviewed(assessmentId: string, reviewerId: string, notes?: string): Promise<void> {
    try {
      await prisma.crisisAssessment.update({
        where: { id: assessmentId },
        data: {
          reviewed: true,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
      });

      logger.info({
        assessmentId,
        reviewerId
      }, 'Crisis assessment marked as reviewed');

    } catch (error) {
      logger.error({
        assessmentId,
        reviewerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to mark assessment as reviewed');

      throw error;
    }
  }

  /**
   * Escalate assessment
   */
  async escalateAssessment(assessmentId: string, escalationLevel: string, notes?: string): Promise<void> {
    try {
      await prisma.crisisAssessment.update({
        where: { id: assessmentId },
        data: {
          escalated: true,
          escalationLevel,
          escalationNotes: notes,
          escalatedAt: new Date(),
        },
      });

      logger.warn({
        assessmentId,
        escalationLevel
      }, 'Crisis assessment escalated');

    } catch (error) {
      logger.error({
        assessmentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to escalate assessment');

      throw error;
    }
  }

  // Private methods

  private async performAnalysis(message: string, context?: string[]): Promise<CrisisIndicator[]> {
    const indicators: CrisisIndicator[] = [];

    // Layer 1: Keyword-based detection
    const keywordIndicators = this.keywordBasedDetection(message);
    indicators.push(...keywordIndicators);

    // Layer 2: Pattern-based detection
    const patternIndicators = this.patternBasedDetection(message);
    indicators.push(...patternIndicators);

    // Layer 3: AI-powered semantic analysis (if enabled)
    if (this.config.aiModel) {
      try {
        const aiIndicators = await this.aiBasedDetection(message, context);
        indicators.push(...aiIndicators);
      } catch (error) {
        logger.warn({
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'AI-based crisis detection failed, falling back to rule-based');
      }
    }

    return indicators;
  }

  private keywordBasedDetection(text: string): CrisisIndicator[] {
    const indicators: CrisisIndicator[] = [];
    const lowerText = text.toLowerCase();

    const crisisKeywords = {
      high: [
        'suicide', 'kill myself', 'end it all', 'not worth living',
        'self-harm', 'cutting myself', 'overdose', 'hang myself'
      ],
      medium: [
        'depressed', 'hopeless', 'worthless', 'give up',
        'panic attack', 'anxious', 'scared', 'terrified'
      ],
      low: [
        'sad', 'lonely', 'stressed', 'overwhelmed',
        'tired', 'exhausted', 'worried'
      ]
    };

    for (const [level, keywords] of Object.entries(crisisKeywords)) {
      const foundKeywords = keywords.filter(keyword => lowerText.includes(keyword));

      if (foundKeywords.length > 0) {
        indicators.push({
          level: level as 'low' | 'medium' | 'high',
          score: foundKeywords.length * (level === 'high' ? 3 : level === 'medium' ? 2 : 1),
          keywords: foundKeywords,
          categories: ['keyword-based'],
          confidence: Math.min(foundKeywords.length * 0.3, 0.9),
        });
      }
    }

    return indicators;
  }

  private patternBasedDetection(text: string): CrisisIndicator[] {
    const indicators: CrisisIndicator[] = [];

    // Check for repeated negative words
    const negativeWords = ['hate', 'die', 'kill', 'hurt', 'pain', 'suffering'];
    const negativeCount = negativeWords.reduce((count, word) =>
      count + (text.toLowerCase().split(word).length - 1), 0
    );

    if (negativeCount >= 3) {
      indicators.push({
        level: 'medium',
        score: negativeCount * 0.5,
        keywords: [],
        categories: ['pattern-repetition'],
        confidence: Math.min(negativeCount * 0.1, 0.8),
      });
    }

    // Check for urgent language
    const urgentPatterns = ['immediately', 'right now', 'can\'t take it', 'at my limit'];
    const urgentMatches = urgentPatterns.filter(pattern =>
      text.toLowerCase().includes(pattern)
    );

    if (urgentMatches.length > 0) {
      indicators.push({
        level: 'high',
        score: urgentMatches.length * 2,
        keywords: urgentMatches,
        categories: ['urgent-language'],
        confidence: 0.7,
      });
    }

    return indicators;
  }

  private async aiBasedDetection(message: string, context?: string[]): Promise<CrisisIndicator[]> {
    try {
      const prompt = `
Analyze this message for mental health crisis indicators. Consider the context of the conversation.

Message: "${message}"
${context ? `Recent context: ${context.slice(-3).join(' | ')}` : ''}

Respond with a JSON object containing:
- riskLevel: "low", "medium", or "high"
- score: numerical score from 0-10
- indicators: array of specific concerns identified
- confidence: confidence score from 0-1

Only respond with valid JSON.
      `;

      const response = await this.aiService.generateText({
        prompt,
        model: this.config.aiModel,
        temperature: 0.1, // Low temperature for consistent analysis
      });

      const analysis = JSON.parse(response.text);

      if (analysis.riskLevel && analysis.score !== undefined) {
        return [{
          level: analysis.riskLevel,
          score: analysis.score,
          keywords: analysis.indicators || [],
          categories: ['ai-analysis'],
          confidence: analysis.confidence || 0.5,
        }];
      }

      return [];
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'AI-based crisis detection parsing failed');

      return [];
    }
  }

  private calculateOverallScore(indicators: CrisisIndicator[]): number {
    if (indicators.length === 0) return 0;

    // Weighted scoring based on indicator levels and confidence
    const weights = { high: 3, medium: 2, low: 1 };
    const totalScore = indicators.reduce((sum, indicator) =>
      sum + (indicator.score * weights[indicator.level] * indicator.confidence), 0
    );

    return Math.min(totalScore, 10); // Cap at 10
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= this.config.riskThresholds.high) return 'high';
    if (score >= this.config.riskThresholds.medium) return 'medium';
    return 'low';
  }

  private generateRecommendedActions(riskLevel: string, indicators: CrisisIndicator[]): string[] {
    const actions: string[] = [];

    if (riskLevel === 'high') {
      actions.push('Immediate professional intervention required');
      actions.push('Contact emergency services if imminent danger');
      actions.push('Notify designated crisis response team');
    } else if (riskLevel === 'medium') {
      actions.push('Schedule follow-up with mental health professional');
      actions.push('Provide additional support resources');
      actions.push('Monitor conversation closely');
    } else {
      actions.push('Continue monitoring conversation');
      actions.push('Offer general mental health resources');
    }

    // Add specific actions based on indicators
    const hasSelfHarm = indicators.some(i => i.keywords.some(k =>
      k.includes('self-harm') || k.includes('cutting') || k.includes('suicide')
    ));

    if (hasSelfHarm) {
      actions.push('Immediate safety assessment required');
    }

    return actions;
  }

  private async storeAssessment(assessment: CrisisAssessment): Promise<void> {
    try {
      await (prisma as any).crisisAssessment.create({
        data: {
          conversationId: assessment.conversationId,
          userId: assessment.userId,
          riskLevel: assessment.riskLevel,
          indicators: assessment.indicators,
          overallScore: assessment.overallScore,
          recommendedActions: assessment.recommendedActions,
          flaggedAt: assessment.flaggedAt,
        },
      });
    } catch (error) {
      logger.error({
        conversationId: assessment.conversationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to store crisis assessment');
      throw error;
    }
  }

  private async triggerAlerts(assessment: CrisisAssessment): Promise<void> {
    // Implementation for alert system will be added in next steps
    logger.info({
      conversationId: assessment.conversationId,
      riskLevel: assessment.riskLevel,
      channels: this.config.alertChannels
    }, 'Triggering crisis alerts');
  }

  private formatAssessmentFromDb(dbAssessment: any): CrisisAssessment {
    return {
      conversationId: dbAssessment.conversationId,
      userId: dbAssessment.userId,
      riskLevel: dbAssessment.riskLevel,
      indicators: dbAssessment.indicators,
      overallScore: dbAssessment.overallScore,
      recommendedActions: dbAssessment.recommendedActions,
      flaggedAt: dbAssessment.flaggedAt,
      reviewed: dbAssessment.reviewed,
      escalated: dbAssessment.escalated,
    };
  }
}