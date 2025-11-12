import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  IAiProvider,
  AiRequest,
  AiResponse,
  TokenUsage,
  ResponseMetadata,
  ModelInfo,
  ProviderConfig,
  ConversationContext
} from './IAiProvider';

export class GoogleAiProvider implements IAiProvider {
  id = 'google';
  name = 'Google AI';

  private client: GoogleGenerativeAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async generateText(request: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: request.model || 'gemini-pro',
      });

      const generationConfig = {
        temperature: request.temperature || 0.7,
        maxOutputTokens: request.maxTokens || 1000,
      };

      const chat = model.startChat({
        history: this.buildHistory(request),
        generationConfig,
      });

      const prompt = request.context?.messages ?
        request.context.messages[request.context.messages.length - 1]?.content || request.prompt :
        request.prompt;

      const result = await chat.sendMessage(prompt);
      const response = result.response.text();

      // Google AI doesn't provide token usage in the same way, so we estimate
      const estimatedTokens = this.estimateTokens(prompt + response);

      const tokenUsage: TokenUsage = {
        promptTokens: Math.floor(estimatedTokens * 0.4), // Rough estimate
        completionTokens: Math.floor(estimatedTokens * 0.6),
        totalTokens: estimatedTokens,
      };

      const metadata: ResponseMetadata = {
        provider: this.id,
        model: request.model || 'gemini-pro',
        processingTime: Date.now() - startTime,
        cost: this.calculateCost(tokenUsage, request.model || 'gemini-pro'),
      };

      return {
        text: response,
        usage: tokenUsage,
        metadata,
      };
    } catch (error) {
      throw new Error(`Google AI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStream(request: AiRequest): AsyncIterable<AiResponse> {
    const startTime = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: request.model || 'gemini-pro',
      });

      const generationConfig = {
        temperature: request.temperature || 0.7,
        maxOutputTokens: request.maxTokens || 1000,
      };

      const chat = model.startChat({
        history: this.buildHistory(request),
        generationConfig,
      });

      const prompt = request.context?.messages ?
        request.context.messages[request.context.messages.length - 1]?.content || request.prompt :
        request.prompt;

      const streamingResponse = await chat.sendMessageStream(prompt);

      let accumulatedText = '';
      let totalTokens = 0;

      for await (const chunk of streamingResponse.stream) {
        const chunkText = chunk.text();
        accumulatedText += chunkText;

        const estimatedTokens = this.estimateTokens(accumulatedText);
        totalTokens = estimatedTokens;

        const tokenUsage: TokenUsage = {
          promptTokens: Math.floor(totalTokens * 0.4),
          completionTokens: Math.floor(totalTokens * 0.6),
          totalTokens,
        };

        const metadata: ResponseMetadata = {
          provider: this.id,
          model: request.model || 'gemini-pro',
          processingTime: Date.now() - startTime,
          cost: this.calculateCost(tokenUsage, request.model || 'gemini-pro'),
        };

        yield {
          text: accumulatedText,
          usage: tokenUsage,
          metadata,
        };
      }
    } catch (error) {
      throw new Error(`Google AI streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    // Google AI doesn't have a public models API, so return known models
    return [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        contextWindow: 32768,
        costPerToken: 0.00025, // $0.00025 per character (rough estimate)
      },
      {
        id: 'gemini-pro-vision',
        name: 'Gemini Pro Vision',
        contextWindow: 16384,
        costPerToken: 0.00025,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 1048576,
        costPerToken: 0.00125, // Higher cost for larger context
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1048576,
        costPerToken: 0.000075, // Lower cost for faster model
      },
    ];
  }

  validateConfig(config: ProviderConfig): boolean {
    return !!(config.apiKey && config.apiKey.length > 0);
  }

  private buildHistory(request: AiRequest): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (request.context?.messages) {
      for (const message of request.context.messages.slice(0, -1)) { // Exclude the last message as it's the prompt
        history.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        });
      }
    }

    return history;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private calculateCost(usage: TokenUsage, model: string): number {
    const costPerToken = this.getCostPerToken(model);
    return usage.totalTokens * costPerToken;
  }

  private getCostPerToken(model: string): number {
    const costs: Record<string, number> = {
      'gemini-pro': 0.00025, // $0.00025 per character
      'gemini-pro-vision': 0.00025,
      'gemini-1.5-pro': 0.00125, // $0.00125 per character
      'gemini-1.5-flash': 0.000075, // $0.000075 per character
    };
    return costs[model] || 0.00025;
  }
}