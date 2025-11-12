import { prisma } from '@/lib/prisma';
import { EncryptionService, ApiKeyValidator } from '@/lib/encryption';
import { logInfo, logError, logWarn } from '@/lib/logger';

export interface ApiKeyData {
  name: string;
  provider: string;
  apiKey: string;
  usageLimit?: number;
}

export interface ApiKeyWithStats {
  id: string;
  name: string;
  provider: string;
  usageCount: number;
  lastUsed?: Date;
  monthlyUsage: number;
  usageLimit?: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ApiKeyService {
  private encryption = EncryptionService.getInstance();

  // Create a new API key
  async createApiKey(userId: string, data: ApiKeyData): Promise<ApiKeyWithStats> {
    try {
      // Validate API key format
      if (!ApiKeyValidator.isValidApiKey(data.provider, data.apiKey)) {
        throw new Error(`Invalid API key format for provider: ${data.provider}`);
      }

      // Check for duplicate names
      const existing = await prisma.apiKey.findFirst({
        where: { userId, name: data.name },
      });

      if (existing) {
        throw new Error(`API key with name "${data.name}" already exists`);
      }

      // Encrypt the API key
      const encryptedKey = this.encryption.encrypt(data.apiKey);

      // Create the API key record
      const apiKey = await prisma.apiKey.create({
        data: {
          userId,
          name: data.name,
          provider: data.provider,
          encryptedKey,
          usageLimit: data.usageLimit,
        },
      });

      logInfo('API key created successfully', {
        userId,
        keyId: apiKey.id,
        provider: data.provider,
        name: data.name,
      });

      return this.formatApiKey(apiKey);
    } catch (error) {
      logError('Failed to create API key', error, { userId, provider: data.provider });
      throw error;
    }
  }

  // Get all API keys for a user
  async getUserApiKeys(userId: string): Promise<ApiKeyWithStats[]> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return apiKeys.map(key => this.formatApiKey(key));
    } catch (error) {
      logError('Failed to get user API keys', error, { userId });
      throw error;
    }
  }

  // Get a specific API key by ID
  async getApiKey(userId: string, keyId: string): Promise<ApiKeyWithStats | null> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: { id: keyId, userId },
      });

      return apiKey ? this.formatApiKey(apiKey) : null;
    } catch (error) {
      logError('Failed to get API key', error, { userId, keyId });
      throw error;
    }
  }

  // Update an API key
  async updateApiKey(userId: string, keyId: string, updates: Partial<ApiKeyData>): Promise<ApiKeyWithStats> {
    try {
      const updateData: any = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.provider) updateData.provider = updates.provider;
      if (updates.usageLimit !== undefined) updateData.usageLimit = updates.usageLimit;

      if (updates.apiKey) {
        // Validate and encrypt new key
        if (!ApiKeyValidator.isValidApiKey(updates.provider || 'unknown', updates.apiKey)) {
          throw new Error(`Invalid API key format for provider: ${updates.provider}`);
        }
        updateData.encryptedKey = this.encryption.encrypt(updates.apiKey);
      }

      const apiKey = await prisma.apiKey.update({
        where: { id: keyId, userId },
        data: updateData,
      });

      logInfo('API key updated successfully', {
        userId,
        keyId,
        updates: Object.keys(updates),
      });

      return this.formatApiKey(apiKey);
    } catch (error) {
      logError('Failed to update API key', error, { userId, keyId });
      throw error;
    }
  }

  // Delete an API key
  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    try {
      await prisma.apiKey.delete({
        where: { id: keyId, userId },
      });

      logInfo('API key deleted successfully', { userId, keyId });
    } catch (error) {
      logError('Failed to delete API key', error, { userId, keyId });
      throw error;
    }
  }

  // Get decrypted API key for use
  async getDecryptedKey(userId: string, keyId: string): Promise<string | null> {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: { id: keyId, userId, isActive: true },
      });

      if (!apiKey) return null;

      // Check expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        logWarn('Attempted to use expired API key', { userId, keyId });
        return null;
      }

      // Update usage statistics
      await this.incrementUsage(keyId);

      return this.encryption.decrypt(apiKey.encryptedKey);
    } catch (error) {
      logError('Failed to get decrypted API key', error, { userId, keyId });
      return null;
    }
  }

  // Test API key validity
  async testApiKey(userId: string, keyId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const decryptedKey = await this.getDecryptedKey(userId, keyId);
      if (!decryptedKey) {
        return { valid: false, error: 'API key not found or inactive' };
      }

      // Here you would make a test API call to the provider
      // For now, we'll just validate the format
      const apiKey = await prisma.apiKey.findFirst({
        where: { id: keyId, userId },
      });

      if (!apiKey) {
        return { valid: false, error: 'API key not found' };
      }

      const isValid = ApiKeyValidator.isValidApiKey(apiKey.provider, decryptedKey);
      return {
        valid: isValid,
        error: isValid ? undefined : 'Invalid API key format',
      };
    } catch (error) {
      logError('Failed to test API key', error, { userId, keyId });
      return { valid: false, error: 'Test failed' };
    }
  }

  // Get platform-managed keys (fallback when user has no keys)
  async getPlatformKey(provider: string): Promise<string | null> {
    // This would typically pull from a pool of platform-managed keys
    // For now, return null to indicate no platform keys available
    logInfo('Platform key requested', { provider });
    return null; // Implement platform key management later
  }

  // Increment usage counter
  private async incrementUsage(keyId: string): Promise<void> {
    try {
      await prisma.apiKey.update({
        where: { id: keyId },
        data: {
          usageCount: { increment: 1 },
          monthlyUsage: { increment: 1 },
          lastUsed: new Date(),
        },
      });
    } catch (error) {
      logError('Failed to increment usage', error, { keyId });
    }
  }

  // Format API key for response (without encrypted key)
  private formatApiKey(apiKey: any): ApiKeyWithStats {
    return {
      id: apiKey.id,
      name: apiKey.name,
      provider: apiKey.provider,
      usageCount: apiKey.usageCount,
      lastUsed: apiKey.lastUsed,
      monthlyUsage: apiKey.monthlyUsage,
      usageLimit: apiKey.usageLimit,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }
}

// Global instance
export const apiKeyService = new ApiKeyService();