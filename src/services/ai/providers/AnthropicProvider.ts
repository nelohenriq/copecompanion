import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider implements IAiProvider {
  id = 'anthropic';
  name = 'Anthropic';

  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async generateText(request: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      const messages = this.buildMessages(request);

      const message = await this.client.messages.create({
        model: request.model || 'claude-3-sonnet-20240229',
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        messages,
      });

      const response = message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.type === 'text' ? block.text : '')
        .join('');

      const tokenUsage: TokenUsage = {
        promptTokens: message.usage?.input_tokens || 0,
        completionTokens: message.usage?.output_tokens || 0,
        totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
      };

      const metadata: ResponseMetadata = {
        provider: this.id,
        model: message.model,
        processingTime: Date.now() - startTime,
        cost: this.calculateCost(tokenUsage, message.model),
      };

      return {
        text: response,
        usage: tokenUsage,
        metadata,
      };
    } catch (error) {
      throw new Error(`Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStream(request: AiRequest): AsyncIterable<AiResponse> {
    const startTime = Date.now();

    try {
      const messages = this.buildMessages(request);

      const stream = await this.client.messages.create({
        model: request.model || 'claude-3-sonnet-20240229',
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        messages,
        stream: true,
      });

      let accumulatedText = '';
      let usage: TokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          accumulatedText += event.delta.text;
        }

        if (event.type === 'message_delta' && event.usage) {
          usage = {
            promptTokens: event.usage.input_tokens || 0,
            completionTokens: event.usage.output_tokens || 0,
            totalTokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
          };
        }

        const metadata: ResponseMetadata = {
          provider: this.id,
          model: request.model || 'claude-3-sonnet-20240229',
          processingTime: Date.now() - startTime,
          cost: this.calculateCost(usage, request.model || 'claude-3-sonnet-20240229'),
        };

        yield {
          text: accumulatedText,
          usage,
          metadata,
        };
      }
    } catch (error) {
      throw new Error(`Anthropic streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a public models API, so return known models
    return [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        costPerToken: 0.015, // $15 per million input tokens
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        contextWindow: 200000,
        costPerToken: 0.003, // $3 per million input tokens
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        contextWindow: 200000,
        costPerToken: 0.00025, // $0.25 per million input tokens
      },
      {
        id: 'claude-2.1',
        name: 'Claude 2.1',
        contextWindow: 200000,
        costPerToken: 0.008, // $8 per million input tokens
      },
    ];
  }

  validateConfig(config: ProviderConfig): boolean {
    return !!(config.apiKey && config.apiKey.length > 0);
  }

  private buildMessages(request: AiRequest): Anthropic.Messages.MessageParam[] {
    const messages: Anthropic.Messages.MessageParam[] = [];

    if (request.context?.messages) {
      messages.push(...request.context.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content,
      })));
    } else {
      messages.push({
        role: 'user',
        content: request.prompt,
      });
    }

    return messages;
  }

  private calculateCost(usage: TokenUsage, model: string): number {
    const costPerMillionTokens = this.getCostPerToken(model);
    return (usage.totalTokens / 1000000) * costPerMillionTokens;
  }

  private getCostPerToken(model: string): number {
    const costs: Record<string, number> = {
      'claude-3-opus-20240229': 15, // $15 per million tokens
      'claude-3-sonnet-20240229': 3, // $3 per million tokens
      'claude-3-haiku-20240307': 0.25, // $0.25 per million tokens
      'claude-2.1': 8, // $8 per million tokens
    };
    return costs[model] || 3; // Default to Sonnet pricing
  }
}