import { apiKeyService } from '../../lib/api-key-service';
import { OpenAiProvider } from './providers/OpenAiProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GoogleAiProvider } from './providers/GoogleAiProvider';
import { IAiProvider } from './providers/IAiProvider';
import { ProviderConfig } from './providers/IAiProvider';
import { logger } from '../../lib/logger';

export class AiProviderFactory {
  /**
   * Create AI providers for a user based on their stored API keys
   */
  static async createProvidersForUser(userId: string): Promise<Map<string, IAiProvider>> {
    const providers = new Map<string, IAiProvider>();

    try {
      // Get all user's API keys
      const userKeys = await apiKeyService.getUserApiKeys(userId);

      // Group keys by provider
      const keysByProvider = new Map<string, string>();
      for (const key of userKeys) {
        if (key.isActive && (!key.expiresAt || key.expiresAt > new Date())) {
          // Get the decrypted key
          const decryptedKey = await apiKeyService.getDecryptedKey(userId, key.id);
          if (decryptedKey) {
            keysByProvider.set(key.provider, decryptedKey);
          }
        }
      }

      // Create providers for available keys
      if (keysByProvider.has('openai')) {
        const config: ProviderConfig = {
          apiKey: keysByProvider.get('openai')!,
        };
        providers.set('openai', new OpenAiProvider(config));
        logger.info({ userId, provider: 'openai' }, 'Created OpenAI provider for user');
      }

      if (keysByProvider.has('anthropic')) {
        const config: ProviderConfig = {
          apiKey: keysByProvider.get('anthropic')!,
        };
        providers.set('anthropic', new AnthropicProvider(config));
        logger.info({ userId, provider: 'anthropic' }, 'Created Anthropic provider for user');
      }

      if (keysByProvider.has('google')) {
        const config: ProviderConfig = {
          apiKey: keysByProvider.get('google')!,
        };
        providers.set('google', new GoogleAiProvider(config));
        logger.info({ userId, provider: 'google' }, 'Created Google AI provider for user');
      }

      logger.info({
        userId,
        providerCount: providers.size,
        providers: Array.from(providers.keys())
      }, 'Created AI providers for user');

    } catch (error) {
      logger.error({
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to create AI providers for user');
    }

    return providers;
  }

  /**
   * Create a single provider instance
   */
  static createProvider(providerId: string, config: ProviderConfig): IAiProvider {
    switch (providerId) {
      case 'openai':
        return new OpenAiProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'google':
        return new GoogleAiProvider(config);
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }

  /**
   * Get platform-managed providers (fallback when user has no keys)
   * This would use platform API keys for basic functionality
   */
  static async createPlatformProviders(): Promise<Map<string, IAiProvider>> {
    const providers = new Map<string, IAiProvider>();

    // Try to get platform keys
    const openaiKey = await apiKeyService.getPlatformKey('openai');
    if (openaiKey) {
      providers.set('openai', new OpenAiProvider({ apiKey: openaiKey }));
    }

    const anthropicKey = await apiKeyService.getPlatformKey('anthropic');
    if (anthropicKey) {
      providers.set('anthropic', new AnthropicProvider({ apiKey: anthropicKey }));
    }

    const googleKey = await apiKeyService.getPlatformKey('google');
    if (googleKey) {
      providers.set('google', new GoogleAiProvider({ apiKey: googleKey }));
    }

    logger.info({
      providerCount: providers.size,
      providers: Array.from(providers.keys())
    }, 'Created platform AI providers');

    return providers;
  }

  /**
   * Validate provider configuration
   */
  static async validateProviderConfig(userId: string, providerId: string, apiKey: string): Promise<boolean> {
    try {
      const provider = this.createProvider(providerId, { apiKey });
      return provider.validateConfig({ apiKey });
    } catch (error) {
      logger.error({
        userId,
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Provider config validation failed');
      return false;
    }
  }
}