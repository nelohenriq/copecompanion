import { prisma } from '@/lib/prisma';
import { AiService } from '@/services/ai/AiService';
import { logger } from '@/lib/logger';

export interface QualityCheckItem {
  id: string;
  name: string;
  description: string;
  required: boolean;
  score?: number; // 0-1
  passed?: boolean;
  notes?: string;
  aiAnalysis?: string;
}

export interface QualityValidationResult {
  overallScore: number; // 0-1
  passed: boolean;
  requiredChecksPassed: boolean;
  checks: QualityCheckItem[];
  recommendations: string[];
  automatedAnalysis: string;
}

export class ContentQualityService {
  private aiService: AiService;

  constructor() {
    this.aiService = new AiService({
      userId: 'system',
      cacheEnabled: true,
      cacheTtl: 3600,
    });
  }

  /**
   * Validate content quality against checklist
   */
  async validateContent(contentId: string): Promise<QualityValidationResult> {
    try {
      // Get content and appropriate checklist
      const content = await (prisma as any).content.findUnique({
        where: { id: contentId },
      });

      if (!content) {
        throw new Error('Content not found');
      }

      // Get quality checklist for content type
      const checklist = await this.getQualityChecklist(content.contentType);

      // Perform automated quality analysis
      const automatedAnalysis = await this.performAutomatedAnalysis(content, checklist);

      // Evaluate each checklist item
      const checks: QualityCheckItem[] = [];
      let totalScore = 0;
      let requiredChecksPassed = true;

      for (const item of checklist) {
        const checkResult = await this.evaluateChecklistItem(content, item, automatedAnalysis);
        checks.push(checkResult);

        if (checkResult.score !== undefined) {
          totalScore += checkResult.score;
        }

        if (item.required && !checkResult.passed) {
          requiredChecksPassed = false;
        }
      }

      const overallScore = checks.length > 0 ? totalScore / checks.length : 0;
      const passed = overallScore >= 0.7 && requiredChecksPassed;

      const recommendations = this.generateRecommendations(checks, content);

      const result: QualityValidationResult = {
        overallScore,
        passed,
        requiredChecksPassed,
        checks,
        recommendations,
        automatedAnalysis,
      };

      logger.info({
        contentId,
        overallScore,
        passed,
        checksCount: checks.length,
      }, 'Content quality validation completed');

      return result;

    } catch (error) {
      logger.error({
        contentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Content quality validation failed');

      // Return basic result on failure
      return {
        overallScore: 0,
        passed: false,
        requiredChecksPassed: false,
        checks: [],
        recommendations: ['Quality validation failed - manual review required'],
        automatedAnalysis: 'Automated analysis could not be completed',
      };
    }
  }

  /**
   * Get quality checklist for content type
   */
  private async getQualityChecklist(contentType: string): Promise<QualityCheckItem[]> {
    // Try to get custom checklist from database first
    const customChecklist = await (prisma as any).contentQualityChecklist.findFirst({
      where: {
        contentTypes: { has: contentType },
        isActive: true,
      },
    });

    if (customChecklist) {
      return customChecklist.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        required: item.required,
      }));
    }

    // Fall back to default checklists
    const defaultChecklists: Record<string, QualityCheckItem[]> = {
      article: [
        { id: 'accuracy', name: 'Factual Accuracy', description: 'Information is accurate and up-to-date', required: true },
        { id: 'sources', name: 'Source Citations', description: 'Key claims supported by credible sources', required: true },
        { id: 'objectivity', name: 'Balanced Perspective', description: 'Presents balanced view without bias', required: true },
        { id: 'readability', name: 'Clear Language', description: 'Written in clear, accessible language', required: true },
        { id: 'structure', name: 'Logical Structure', description: 'Well-organized with clear introduction and conclusion', required: false },
        { id: 'length', name: 'Appropriate Length', description: 'Content length appropriate for topic and audience', required: false },
      ],
      exercise: [
        { id: 'safety', name: 'Safety Instructions', description: 'Clear safety guidelines and contraindications', required: true },
        { id: 'instructions', name: 'Clear Instructions', description: 'Step-by-step instructions are easy to follow', required: true },
        { id: 'progression', name: 'Progressive Difficulty', description: 'Exercises build progressively in difficulty', required: false },
        { id: 'modifications', name: 'Modifications Provided', description: 'Alternative versions for different ability levels', required: false },
        { id: 'duration', name: 'Time Estimates', description: 'Realistic time estimates for completion', required: true },
        { id: 'benefits', name: 'Benefits Explained', description: 'Clear explanation of expected benefits', required: true },
      ],
      // Add other content types as needed
    };

    return defaultChecklists[contentType] || [];
  }

  /**
   * Perform automated quality analysis using AI
   */
  private async performAutomatedAnalysis(content: any, checklist: QualityCheckItem[]): Promise<string> {
    try {
      const analysisPrompt = `
Analyze the quality of this mental health content based on the following criteria:

Content Title: "${content.title}"
Content Type: ${content.contentType}
Target Audience: ${content.targetAudience.join(', ')}
Content: "${content.content || content.description}"

Quality Criteria to Evaluate:
${checklist.map(item => `- ${item.name}: ${item.description} (${item.required ? 'Required' : 'Optional'})`).join('\n')}

Provide a detailed analysis of how well this content meets each criterion. Be specific about strengths and areas for improvement. Focus on mental health content quality, accuracy, safety, and appropriateness.

Return your analysis as a structured evaluation.`;

      const analysis = await this.aiService.generateText({
        prompt: analysisPrompt,
        temperature: 0.2,
        maxTokens: 1000,
      });

      return analysis.text;

    } catch (error) {
      logger.warn({
        contentId: content.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Automated quality analysis failed');

      return 'Automated analysis could not be completed due to technical issues.';
    }
  }

  /**
   * Evaluate individual checklist item
   */
  private async evaluateChecklistItem(content: any, item: QualityCheckItem, automatedAnalysis: string): Promise<QualityCheckItem> {
    try {
      const evaluationPrompt = `
Based on this automated analysis of the content, evaluate whether the content meets the criterion "${item.name}: ${item.description}".

Automated Analysis:
${automatedAnalysis}

Content Details:
Title: "${content.title}"
Type: ${content.contentType}
Content: "${content.content || content.description}"

Return a JSON response with:
{
  "passed": boolean,
  "score": number (0-1),
  "notes": "brief explanation of the evaluation",
  "confidence": number (0-1)
}`;

      const evaluation = await this.aiService.generateText({
        prompt: evaluationPrompt,
        temperature: 0.1,
      });

      let result;
      try {
        result = JSON.parse(evaluation.text);
      } catch {
        // Fallback evaluation
        result = {
          passed: false,
          score: 0.5,
          notes: 'Automated evaluation could not be completed',
          confidence: 0.5,
        };
      }

      return {
        ...item,
        score: result.score,
        passed: result.passed,
        notes: result.notes,
        aiAnalysis: `Confidence: ${result.confidence * 100}%`,
      };

    } catch (error) {
      // Fallback to basic evaluation
      return {
        ...item,
        score: 0.5,
        passed: false,
        notes: 'Evaluation failed - manual review required',
      };
    }
  }

  /**
   * Generate recommendations based on evaluation results
   */
  private generateRecommendations(checks: QualityCheckItem[], content: any): string[] {
    const recommendations: string[] = [];

    // Analyze failed checks
    const failedChecks = checks.filter(check => !check.passed);

    for (const check of failedChecks) {
      switch (check.id) {
        case 'accuracy':
          recommendations.push('Verify all factual claims with credible sources and update any outdated information');
          break;
        case 'sources':
          recommendations.push('Add citations for key claims and provide references section');
          break;
        case 'safety':
          recommendations.push('Include clear safety instructions and contraindications');
          break;
        case 'instructions':
          recommendations.push('Provide clearer, more detailed step-by-step instructions');
          break;
        case 'readability':
          recommendations.push('Simplify language and improve clarity for target audience');
          break;
        case 'structure':
          recommendations.push('Reorganize content with clear introduction, body, and conclusion');
          break;
        default:
          recommendations.push(`Address ${check.name.toLowerCase()} concerns`);
      }
    }

    // Content-specific recommendations
    if (content.contentType === 'article' && (!content.content || content.content.length < 300)) {
      recommendations.push('Expand article content to provide more comprehensive coverage');
    }

    if (content.contentType === 'exercise' && !content.readingTime) {
      recommendations.push('Add estimated completion time for the exercise');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Content quality is good - consider minor enhancements for even better user experience');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }
}