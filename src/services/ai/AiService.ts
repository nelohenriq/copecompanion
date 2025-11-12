import { createHash } from 'crypto';
import {
  IAiProvider,
  AiRequest,
  AiResponse,
  ProviderConfig,
  ConversationContext
} from './providers/IAiProvider';
import { OpenAiProvider } from './providers/OpenAiProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GoogleAiProvider } from './providers/GoogleAiProvider';
import { AiProviderFactory } from './AiProviderFactory';
import { logger } from '../../lib/logger';

export interface AiServiceConfig {
  userId?: string; // If provided, will load user's API keys
  providers?: { // Fallback static provider configs
    openai?: ProviderConfig;
    anthropic?: ProviderConfig;
    google?: ProviderConfig;
  };
  defaultProvider?: string;
  cacheEnabled?: boolean;
  cacheTtl?: number; // seconds
}

export class AiService {
  private providers: Map<string, IAiProvider> = new Map();
  private config: AiServiceConfig;
  private cache: Map<string, { response: AiResponse; expires: number }> = new Map();

  constructor(config: AiServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    await this.initializeProviders();
  }

  async generateText(request: AiRequest): Promise<AiResponse> {
    const cacheKey = this.generateCacheKey(request);

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        logger.info({ cacheKey }, 'Cache hit for AI request');
        return cached;
      }
    }

    const provider = this.selectProvider(request);
    if (!provider) {
      throw new Error('No suitable AI provider available');
    }

    try {
      logger.info({
        provider: provider.id,
        model: request.model,
        hasContext: !!request.context
      }, 'Generating AI response');

      const response = await provider.generateText(request);

      // Cache the response
      if (this.config.cacheEnabled) {
        this.setCachedResponse(cacheKey, response);
      }

      return response;
    } catch (error) {
      logger.error({
        provider: provider.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'AI provider error');

      // Try failover to another provider
      const fallbackProvider = this.selectFallbackProvider(provider.id, request);
      if (fallbackProvider) {
        logger.info({ provider: fallbackProvider.id }, 'Attempting failover to provider');
        try {
          const fallbackResponse = await fallbackProvider.generateText(request);
          if (this.config.cacheEnabled) {
            this.setCachedResponse(cacheKey, fallbackResponse);
          }
          return fallbackResponse;
        } catch (fallbackError) {
          logger.error({
            provider: fallbackProvider.id,
            error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          }, 'Fallback provider also failed');
        }
      }

      throw error;
    }
  }

  async *generateStream(request: AiRequest): AsyncIterable<AiResponse> {
    const provider = this.selectProvider(request);
    if (!provider) {
      throw new Error('No suitable AI provider available');
    }

    try {
      logger.info({
        provider: provider.id,
        model: request.model
      }, 'Starting AI streaming response');

      yield* provider.generateStream(request);
    } catch (error) {
      logger.error({
        provider: provider.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'AI streaming error');
      throw error;
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderModels(providerId: string): Promise<Array<{ id: string; name: string }>> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return provider.getModels().then(models =>
      models.map(model => ({ id: model.id, name: model.name }))
    );
  }

  private async initializeProviders(): Promise<void> {
    // First try to load user-specific providers
    if (this.config.userId) {
      this.providers = await AiProviderFactory.createProvidersForUser(this.config.userId);
    }

    // If no user providers or user has none, fall back to static configs
    if (this.providers.size === 0 && this.config.providers) {
      if (this.config.providers.openai) {
        this.providers.set('openai', new OpenAiProvider(this.config.providers.openai));
      }

      if (this.config.providers.anthropic) {
        this.providers.set('anthropic', new AnthropicProvider(this.config.providers.anthropic));
      }

      if (this.config.providers.google) {
        this.providers.set('google', new GoogleAiProvider(this.config.providers.google));
      }
    }

    // If still no providers, try platform providers as last resort
    if (this.providers.size === 0) {
      this.providers = await AiProviderFactory.createPlatformProviders();
    }

    logger.info({
      userId: this.config.userId,
      providers: Array.from(this.providers.keys())
    }, 'Initialized AI providers');
  }

  private selectProvider(request: AiRequest): IAiProvider | null {
    // If specific provider requested, use it
    if (request.model?.includes('gpt')) {
      return this.providers.get('openai') || null;
    }
    if (request.model?.includes('claude')) {
      return this.providers.get('anthropic') || null;
    }
    if (request.model?.includes('gemini')) {
      return this.providers.get('google') || null;
    }

    // Cost-based selection (simplified)
    const availableProviders = Array.from(this.providers.values());
    if (availableProviders.length === 0) {
      return null;
    }

    // For now, prefer OpenAI, then Anthropic, then Google
    return availableProviders.find(p => p.id === 'openai') ||
           availableProviders.find(p => p.id === 'anthropic') ||
           availableProviders[0];
  }

  private selectFallbackProvider(failedProviderId: string, request: AiRequest): IAiProvider | null {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.id !== failedProviderId);

    if (availableProviders.length === 0) {
      return null;
    }

    // Simple round-robin fallback
    return availableProviders[0];
  }

  private generateCacheKey(request: AiRequest): string {
    const keyData = {
      prompt: request.prompt,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      context: request.context ? {
        sessionId: request.context.sessionId,
        messageCount: request.context.messages.length,
        lastMessage: request.context.messages[request.context.messages.length - 1]?.content.substring(0, 100)
      } : null
    };

    return createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  private getCachedResponse(cacheKey: string): AiResponse | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expires) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  private setCachedResponse(cacheKey: string, response: AiResponse): void {
    const ttl = this.config.cacheTtl || 3600; // 1 hour default
    const expires = Date.now() + (ttl * 1000);
    this.cache.set(cacheKey, { response, expires });

    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupExpiredCache();
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expires) {
        this.cache.delete(key);
      }
    }
  }
}