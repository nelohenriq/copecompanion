import { logger } from '@/lib/logger';
import { KnowledgeBaseService } from '@/services/knowledge/KnowledgeBaseService';

export interface CrisisIndicators {
  suicideIdeation: boolean;
  selfHarm: boolean;
  severeDepression: boolean;
  acuteAnxiety: boolean;
  substanceAbuse: boolean;
  eatingDisorders: boolean;
  domesticViolence: boolean;
  other: string[];
}

export interface CrisisAssessment {
  userId: string;
  sessionId: string;
  indicators: CrisisIndicators;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detectedAt: Date;
  context: string;
  recommendedActions: CrisisAction[];
  riskFactors: string[];
  immediate: boolean;
}

export interface CrisisAction {
  type: 'escalate' | 'resources' | 'monitor' | 'intervene';
  priority: 'immediate' | 'urgent' | 'routine';
  description: string;
  target: 'professional' | 'emergency_services' | 'user';
  metadata: Record<string, any>;
}

export class CrisisDetectionService {
  private knowledgeService: KnowledgeBaseService;
  private crisisKeywords: Map<string, number> = new Map();
  private riskPatterns: RegExp[] = [];

  constructor() {
    this.knowledgeService = new KnowledgeBaseService();
    this.initializeCrisisPatterns();
  }

  private initializeCrisisPatterns() {
    // Suicide ideation keywords with risk weights
    this.crisisKeywords = new Map([
      // High-risk suicide indicators
      ['kill myself', 0.95],
      ['end my life', 0.95],
      ['suicide', 0.90],
      ['want to die', 0.85],
      ['better off dead', 0.85],
      ['no reason to live', 0.80],
      ['tired of living', 0.75],

      // Self-harm indicators
      ['cut myself', 0.80],
      ['self harm', 0.75],
      ['hurt myself', 0.70],
      ['burn myself', 0.70],

      // Severe depression indicators
      ['worthless', 0.60],
      ['hopeless', 0.65],
      ['no future', 0.60],
      ['give up', 0.55],

      // Acute anxiety indicators
      ['panic attack', 0.50],
      ['can\'t breathe', 0.55],
      ['heart racing', 0.45],
      ['terrified', 0.50],

      // Substance abuse indicators
      ['overdose', 0.70],
      ['drink myself to death', 0.65],
      ['drugs', 0.40], // Lower weight as context matters

      // Eating disorder indicators
      ['starve myself', 0.60],
      ['binge', 0.35],
      ['purge', 0.45],
    ]);

    // Risk pattern regexes
    this.riskPatterns = [
      /\b(kill|hurt| harm)\s+myself\b/i,
      /\b(end|take)\s+my\s+life\b/i,
      /\b(suicide|suicidal)\s+(thoughts|ideation|plan)\b/i,
      /\b(no\s+reason|don'?t\s+want)\s+to\s+live\b/i,
      /\b(better|easier)\s+(off\s+)?dead\b/i,
      /\b(tired|done)\s+(of|with)\s+living\b/i,
    ];
  }

  async analyzeMessage(
    userId: string,
    sessionId: string,
    message: string,
    context: {
      conversationHistory?: string[];
      userHistory?: any;
      sessionMetadata?: Record<string, any>;
    } = {}
  ): Promise<CrisisAssessment | null> {
    try {
      const startTime = Date.now();

      // Multi-layered analysis
      const keywordAnalysis = this.analyzeKeywords(message);
      const patternAnalysis = this.analyzePatterns(message);
      const contextualAnalysis = await this.analyzeContext(message, context);
      const behavioralAnalysis = this.analyzeBehavioralPatterns(context);

      // Combine analysis results
      const combinedRisk = this.combineRiskScores([
        keywordAnalysis,
        patternAnalysis,
        contextualAnalysis,
        behavioralAnalysis
      ]);

      // Determine if crisis detected
      if (combinedRisk.confidence < 0.3) {
        return null; // No crisis detected
      }

      const assessment: CrisisAssessment = {
        userId,
        sessionId,
        indicators: combinedRisk.indicators,
        severity: this.determineSeverity(combinedRisk.confidence, combinedRisk.indicators),
        confidence: combinedRisk.confidence,
        detectedAt: new Date(),
        context: message,
        recommendedActions: this.generateRecommendedActions(combinedRisk),
        riskFactors: combinedRisk.riskFactors,
        immediate: combinedRisk.confidence > 0.8 || this.hasCriticalIndicators(combinedRisk.indicators)
      };

      const analysisTime = Date.now() - startTime;
      logger.info({
        userId,
        sessionId,
        confidence: assessment.confidence,
        severity: assessment.severity,
        analysisTime,
        indicators: Object.keys(assessment.indicators).filter(k => assessment.indicators[k as keyof CrisisIndicators])
      }, 'Crisis assessment completed');

      return assessment;

    } catch (error) {
      logger.error({
        userId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Crisis detection analysis failed');

      // Fail-safe: return low-confidence assessment on error
      return {
        userId,
        sessionId,
        indicators: {} as CrisisIndicators,
        severity: 'low',
        confidence: 0.1,
        detectedAt: new Date(),
        context: message,
        recommendedActions: [],
        riskFactors: ['analysis_error'],
        immediate: false
      };
    }
  }

  private analyzeKeywords(message: string): { confidence: number; indicators: Partial<CrisisIndicators>; riskFactors: string[] } {
    const lowerMessage = message.toLowerCase();
    let totalScore = 0;
    let matchCount = 0;
    const indicators: Partial<CrisisIndicators> = {};
    const riskFactors: string[] = [];

    for (const [keyword, weight] of this.crisisKeywords) {
      if (lowerMessage.includes(keyword)) {
        totalScore += weight;
        matchCount++;

        // Map keywords to indicators
        if (keyword.includes('suicide') || keyword.includes('kill myself') || keyword.includes('end my life')) {
          indicators.suicideIdeation = true;
        } else if (keyword.includes('cut myself') || keyword.includes('self harm') || keyword.includes('hurt myself')) {
          indicators.selfHarm = true;
        } else if (keyword.includes('worthless') || keyword.includes('hopeless')) {
          indicators.severeDepression = true;
        } else if (keyword.includes('panic') || keyword.includes('terrified')) {
          indicators.acuteAnxiety = true;
        } else if (keyword.includes('overdose') || keyword.includes('drugs')) {
          indicators.substanceAbuse = true;
        }

        riskFactors.push(keyword);
      }
    }

    const confidence = matchCount > 0 ? Math.min(totalScore / matchCount, 1.0) : 0;

    return { confidence, indicators, riskFactors };
  }

  private analyzePatterns(message: string): { confidence: number; indicators: Partial<CrisisIndicators>; riskFactors: string[] } {
    let patternMatches = 0;
    const indicators: Partial<CrisisIndicators> = {};
    const riskFactors: string[] = [];

    for (const pattern of this.riskPatterns) {
      if (pattern.test(message)) {
        patternMatches++;

        // Map patterns to indicators
        const patternStr = pattern.source;
        if (patternStr.includes('suicide|suicidal')) {
          indicators.suicideIdeation = true;
        } else if (patternStr.includes('kill|hurt|harm.*myself')) {
          indicators.selfHarm = true;
        }

        riskFactors.push(`pattern: ${patternStr}`);
      }
    }

    const confidence = Math.min(patternMatches * 0.3, 0.9); // Each pattern match adds 30% confidence

    return { confidence, indicators, riskFactors };
  }

  private async analyzeContext(
    message: string,
    context: any
  ): Promise<{ confidence: number; indicators: Partial<CrisisIndicators>; riskFactors: string[] }> {
    // Use knowledge base to check for contextual crisis indicators
    const knowledgeResults = await this.knowledgeService.searchSimilar(message, 3);

    let contextConfidence = 0;
    const indicators: Partial<CrisisIndicators> = {};
    const riskFactors: string[] = [];

    for (const result of knowledgeResults) {
      const content = result.content.toLowerCase();

      // Check if knowledge base result indicates crisis context
      if (content.includes('crisis') || content.includes('emergency') || content.includes('intervention')) {
        contextConfidence += 0.2;
        riskFactors.push('knowledge_context_match');
      }
    }

    // Analyze conversation history for patterns
    if (context.conversationHistory) {
      const recentMessages = context.conversationHistory.slice(-5); // Last 5 messages
      const crisisMessageCount = recentMessages.filter((msg: string) =>
        this.analyzeKeywords(msg).confidence > 0.5
      ).length;

      if (crisisMessageCount >= 2) {
        contextConfidence += 0.3;
        indicators.severeDepression = true;
        riskFactors.push('repeated_crisis_indicators');
      }
    }

    return {
      confidence: Math.min(contextConfidence, 0.8),
      indicators,
      riskFactors
    };
  }

  private analyzeBehavioralPatterns(context: any): { confidence: number; indicators: Partial<CrisisIndicators>; riskFactors: string[] } {
    let behavioralConfidence = 0;
    const indicators: Partial<CrisisIndicators> = {};
    const riskFactors: string[] = [];

    // Analyze session metadata for behavioral patterns
    if (context.sessionMetadata) {
      const metadata = context.sessionMetadata;

      // Late night sessions (2-6 AM) may indicate higher risk
      if (metadata.hour && (metadata.hour >= 2 && metadata.hour <= 6)) {
        behavioralConfidence += 0.1;
        riskFactors.push('late_night_session');
      }

      // Rapid message frequency may indicate acute distress
      if (metadata.messagesPerMinute && metadata.messagesPerMinute > 5) {
        behavioralConfidence += 0.15;
        indicators.acuteAnxiety = true;
        riskFactors.push('rapid_messaging');
      }

      // Session duration - very short sessions with crisis content
      if (metadata.sessionDuration && metadata.sessionDuration < 60) { // Less than 1 minute
        behavioralConfidence += 0.1;
        riskFactors.push('brief_crisis_session');
      }
    }

    return {
      confidence: behavioralConfidence,
      indicators,
      riskFactors
    };
  }

  private combineRiskScores(
    analyses: Array<{ confidence: number; indicators: Partial<CrisisIndicators>; riskFactors: string[] }>
  ): { confidence: number; indicators: CrisisIndicators; riskFactors: string[] } {
    let totalConfidence = 0;
    const combinedIndicators: CrisisIndicators = {
      suicideIdeation: false,
      selfHarm: false,
      severeDepression: false,
      acuteAnxiety: false,
      substanceAbuse: false,
      eatingDisorders: false,
      domesticViolence: false,
      other: []
    };

    const allRiskFactors: string[] = [];

    for (const analysis of analyses) {
      // Weight the confidence scores (keyword analysis gets highest weight)
      const weight = analyses.indexOf(analysis) === 0 ? 0.4 : 0.2;
      totalConfidence += analysis.confidence * weight;

      // Combine indicators (OR logic - any detection sets the indicator)
      Object.keys(analysis.indicators).forEach(key => {
        const indicatorKey = key as keyof CrisisIndicators;
        if (indicatorKey === 'other') {
          combinedIndicators.other.push(...(analysis.indicators.other || []));
        } else if (analysis.indicators[indicatorKey]) {
          combinedIndicators[indicatorKey] = true;
        }
      });

      allRiskFactors.push(...analysis.riskFactors);
    }

    return {
      confidence: Math.min(totalConfidence, 1.0),
      indicators: combinedIndicators,
      riskFactors: [...new Set(allRiskFactors)] // Remove duplicates
    };
  }

  private determineSeverity(confidence: number, indicators: CrisisIndicators): 'low' | 'medium' | 'high' | 'critical' {
    // Critical indicators always result in critical severity
    if (indicators.suicideIdeation || indicators.selfHarm) {
      return 'critical';
    }

    // High confidence or multiple indicators
    if (confidence > 0.8 || Object.values(indicators).filter(Boolean).length >= 3) {
      return 'high';
    }

    // Medium confidence or 2 indicators
    if (confidence > 0.6 || Object.values(indicators).filter(Boolean).length >= 2) {
      return 'medium';
    }

    return 'low';
  }

  private generateRecommendedActions(combinedRisk: any): CrisisAction[] {
    const actions: CrisisAction[] = [];

    if (combinedRisk.confidence > 0.8 || combinedRisk.indicators.suicideIdeation || combinedRisk.indicators.selfHarm) {
      actions.push({
        type: 'escalate',
        priority: 'immediate',
        description: 'Immediate professional intervention required',
        target: 'professional',
        metadata: { escalationLevel: 'critical' }
      });
    } else if (combinedRisk.confidence > 0.6) {
      actions.push({
        type: 'escalate',
        priority: 'urgent',
        description: 'Urgent professional consultation recommended',
        target: 'professional',
        metadata: { escalationLevel: 'high' }
      });
    }

    // Always provide crisis resources
    actions.push({
      type: 'resources',
      priority: 'immediate',
      description: 'Provide immediate crisis resources and hotlines',
      target: 'user',
      metadata: { resourceType: 'crisis_hotlines' }
    });

    if (combinedRisk.confidence > 0.4) {
      actions.push({
        type: 'monitor',
        priority: 'urgent',
        description: 'Increase monitoring for continued risk assessment',
        target: 'professional',
        metadata: { monitoringLevel: 'elevated' }
      });
    }

    return actions;
  }

  private hasCriticalIndicators(indicators: CrisisIndicators): boolean {
    return indicators.suicideIdeation || indicators.selfHarm;
  }

  // Method to update crisis patterns (for continuous learning)
  updateCrisisPatterns(newPatterns: { keywords?: Map<string, number>; regexes?: RegExp[] }) {
    if (newPatterns.keywords) {
      for (const [keyword, weight] of newPatterns.keywords) {
        this.crisisKeywords.set(keyword, weight);
      }
    }

    if (newPatterns.regexes) {
      this.riskPatterns.push(...newPatterns.regexes);
    }

    logger.info({
      newKeywords: newPatterns.keywords?.size || 0,
      newPatterns: newPatterns.regexes?.length || 0
    }, 'Crisis detection patterns updated');
  }

  // False positive reduction mechanisms
  private applyFalsePositiveFilters(assessment: CrisisAssessment): CrisisAssessment {
    // Filter 1: Contextual negation detection
    if (this.detectNegation(assessment.context)) {
      assessment.confidence *= 0.3; // Reduce confidence significantly
      assessment.riskFactors.push('negation_detected');
    }

    // Filter 2: Historical context analysis
    if (assessment.confidence > 0.7) {
      const historicalRisk = this.analyzeHistoricalPatterns(assessment);
      if (historicalRisk < 0.3) {
        assessment.confidence *= 0.7; // Moderate reduction for low historical risk
        assessment.riskFactors.push('low_historical_risk');
      }
    }

    // Filter 3: Professional context detection
    if (this.detectProfessionalContext(assessment.context)) {
      assessment.confidence *= 0.5; // Reduce confidence for professional discussions
      assessment.riskFactors.push('professional_context');
    }

    // Filter 4: Media/Hypothetical content detection
    if (this.detectHypotheticalContent(assessment.context)) {
      assessment.confidence *= 0.4; // Significant reduction for hypothetical content
      assessment.riskFactors.push('hypothetical_content');
    }

    // Recalculate severity after false positive filtering
    assessment.severity = this.determineSeverity(assessment.confidence, assessment.indicators);

    return assessment;
  }

  private detectNegation(text: string): boolean {
    const negationPatterns = [
      /\b(not|no|never|don't|doesn't|isn't|aren't|wasn't|weren't|won't|can't|cannot)\s+(want|feel|think|going)\s+to/i,
      /\b(not|no)\s+(suicidal|depressed|anxious|harming|myself)/i,
      /\bdon't\s+(kill|hurt)\s+myself/i,
      /\bwould\s+never\s+(kill|hurt)\s+myself/i,
      /\b(not|no)\s+reason\s+to\s+(kill|hurt)\s+myself/i
    ];

    return negationPatterns.some(pattern => pattern.test(text.toLowerCase()));
  }

  private analyzeHistoricalPatterns(assessment: CrisisAssessment): number {
    // This would analyze user's historical interaction patterns
    // For now, return neutral score - would be implemented with user history data
    return 0.5;
  }

  private detectProfessionalContext(text: string): boolean {
    const professionalIndicators = [
      /\b(therapist|psychologist|counselor|doctor|psychiatrist)\b/i,
      /\b(treatment|therapy|medication|counseling)\b/i,
      /\b(diagnosis|assessment|evaluation)\b/i,
      /\b(clinical|professional|medical)\b/i,
      /\b(suicide\s+prevention|crisis\s+intervention)\b/i
    ];

    return professionalIndicators.some(pattern => pattern.test(text));
  }

  private detectHypotheticalContent(text: string): boolean {
    const hypotheticalIndicators = [
      /\b(if|when|what\s+if|suppose|imagine|hypothetical)\b/i,
      /\b(story|movie|book|article|news)\s+(about|regarding)/i,
      /\b(someone|people|they)\s+(who|that)\b/i,
      /\b(example|scenario|situation)\b/i,
      /\b(discussing|talking\s+about|reading\s+about)\b/i
    ];

    return hypotheticalIndicators.some(pattern => pattern.test(text));
  }

  // Enhanced analysis method with false positive reduction
  async analyzeMessageWithFilters(
    userId: string,
    sessionId: string,
    message: string,
    context: {
      conversationHistory?: string[];
      userHistory?: any;
      sessionMetadata?: Record<string, any>;
    } = {}
  ): Promise<CrisisAssessment | null> {
    const assessment = await this.analyzeMessage(userId, sessionId, message, context);

    if (!assessment) {
      return null;
    }

    // Apply false positive reduction filters
    const filteredAssessment = this.applyFalsePositiveFilters(assessment);

    // Re-evaluate if crisis is still detected after filtering
    if (filteredAssessment.confidence < 0.3) {
      return null;
    }

    logger.info({
      userId,
      sessionId,
      originalConfidence: assessment.confidence,
      filteredConfidence: filteredAssessment.confidence,
      filtersApplied: filteredAssessment.riskFactors.filter(f =>
        ['negation_detected', 'low_historical_risk', 'professional_context', 'hypothetical_content'].includes(f)
      )
    }, 'Crisis assessment with false positive filtering applied');

    return filteredAssessment;
  }
}