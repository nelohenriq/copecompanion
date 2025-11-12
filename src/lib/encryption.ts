import CryptoJS from 'crypto-js';

// Encryption service for API keys using AES-256
export class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: string;

  private constructor() {
    // Get encryption key from environment
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';
    if (this.encryptionKey === 'fallback-key-change-in-production') {
      console.warn('WARNING: Using fallback encryption key. Set ENCRYPTION_KEY environment variable in production.');
    }
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  // Encrypt API key
  encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  // Decrypt API key
  decrypt(ciphertext: string): string {
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Generate a secure random key for encryption
  static generateEncryptionKey(): string {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  // Validate encryption key format
  static isValidKey(key: string): boolean {
    return key.length >= 32; // Minimum 256-bit key
  }
}

// API Key validation utilities
export class ApiKeyValidator {
  // Validate OpenAI API key format
  static isValidOpenAIKey(key: string): boolean {
    return key.startsWith('sk-') && key.length > 50;
  }

  // Validate Anthropic API key format
  static isValidAnthropicKey(key: string): boolean {
    return key.startsWith('sk-ant-') && key.length > 60;
  }

  // Validate Google AI API key format
  static isValidGoogleKey(key: string): boolean {
    return key.length > 30 && /^[A-Za-z0-9_-]+$/.test(key);
  }

  // Generic API key validation
  static isValidApiKey(provider: string, key: string): boolean {
    switch (provider.toLowerCase()) {
      case 'openai':
        return this.isValidOpenAIKey(key);
      case 'anthropic':
        return this.isValidAnthropicKey(key);
      case 'google':
        return this.isValidGoogleKey(key);
      default:
        return key.length > 10; // Basic length check for unknown providers
    }
  }
}