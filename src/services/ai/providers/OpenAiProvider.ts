import OpenAI from 'openai';
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

export class OpenAiProvider implements IAiProvider {
  id = 'openai';
  name = 'OpenAI';

  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    });
  }

  async generateText(request: AiRequest): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      const messages = this.buildMessages(request);

      const completion = await this.client.chat.completions.create({
        model: request.model || 'gpt-3.5-turbo',
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
      });

      const response = completion.choices[0]?.message?.content || '';
      const usage = completion.usage;

      const tokenUsage: TokenUsage = {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
      };

      const metadata: ResponseMetadata = {
        provider: this.id,
        model: completion.model,
        processingTime: Date.now() - startTime,
        cost: this.calculateCost(tokenUsage, completion.model),
      };

      return {
        text: response,
        usage: tokenUsage,
        metadata,
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStream(request: AiRequest): AsyncIterable<AiResponse> {
    const startTime = Date.now();
    let totalTokens = 0;
    let promptTokens = 0;

    try {
      const messages = this.buildMessages(request);

      const stream = await this.client.chat.completions.create({
        model: request.model || 'gpt-3.5-turbo',
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1000,
        stream: true,
      });

      let accumulatedText = '';
      let model = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          accumulatedText += delta.content;
        }

        if (chunk.model && !model) {
          model = chunk.model;
        }

        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens || 0;
          totalTokens = chunk.usage.total_tokens || 0;
        }

        // Yield partial response
        const tokenUsage: TokenUsage = {
          promptTokens,
          completionTokens: totalTokens - promptTokens,
          totalTokens,
        };

        const metadata: ResponseMetadata = {
          provider: this.id,
          model: model || request.model || 'gpt-3.5-turbo',
          processingTime: Date.now() - startTime,
          cost: this.calculateCost(tokenUsage, model),
        };

        yield {
          text: accumulatedText,
          usage: tokenUsage,
          metadata,
        };
      }
    } catch (error) {
      throw new Error(`OpenAI streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => ({
          id: model.id,
          name: model.id,
          contextWindow: this.getContextWindow(model.id),
          costPerToken: this.getCostPerToken(model.id),
        }));
    } catch (error) {
      throw new Error(`Failed to fetch OpenAI models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validateConfig(config: ProviderConfig): boolean {
    return !!(config.apiKey && config.apiKey.length > 0);
  }

  private buildMessages(request: AiRequest): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (request.context?.messages) {
      messages.push(...request.context.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
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

  private getContextWindow(model: string): number {
    const contextWindows: Record<string, number> = {
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
    };
    return contextWindows[model] || 4096;
  }

  private getCostPerToken(model: string): number {
    // Approximate costs per 1K tokens (input/output)
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4o': { input: 0.005, output: 0.015 },
    };
    return costs[model]?.input || 0.0015;
  }

  private calculateCost(usage: TokenUsage, model: string): number {
    const costs = this.getCostPerToken(model);
    const inputCost = (usage.promptTokens / 1000) * costs;
    const outputCost = (usage.completionTokens / 1000) * (costs * 2); // Output typically costs more
    return inputCost + outputCost;
  }
}