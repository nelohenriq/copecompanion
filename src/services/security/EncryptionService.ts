import crypto from 'crypto';
import { logger } from '@/lib/logger';

export interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'compromised';
  rotationCount: number;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag?: string;
  keyId: string;
  algorithm: string;
  encryptedAt: Date;
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted' | 'phi';
  retentionPeriod: number; // days
  encryptionRequired: boolean;
  accessLevel: 'public' | 'authenticated' | 'authorized' | 'admin';
}

export class EncryptionService {
  private encryptionKeys: Map<string, EncryptionKey> = new Map();
  private keyRotationInterval: number = 365 * 24 * 60 * 60 * 1000; // 365 days
  private currentKeyId!: string;

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys() {
    // Generate initial encryption key
    const keyId = `key-${Date.now()}`;
    const key = crypto.randomBytes(32); // 256-bit key

    const encryptionKey: EncryptionKey = {
      id: keyId,
      key,
      algorithm: 'aes-256-gcm',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.keyRotationInterval),
      status: 'active',
      rotationCount: 0
    };

    this.encryptionKeys.set(keyId, encryptionKey);
    this.currentKeyId = keyId;

    logger.info({
      keyId,
      algorithm: encryptionKey.algorithm,
      expiresAt: encryptionKey.expiresAt.toISOString()
    }, 'Encryption service initialized with new key');
  }

  async encryptData(data: string, classification: DataClassification): Promise<EncryptedData> {
    try {
      if (!classification.encryptionRequired) {
        throw new Error('Data classification does not require encryption');
      }

      const key = this.encryptionKeys.get(this.currentKeyId);
      if (!key || key.status !== 'active') {
        throw new Error('No active encryption key available');
      }

      // Generate initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher with GCM mode
      const cipher = crypto.createCipher('aes-256-gcm', key.key);
      cipher.setAAD(Buffer.from(JSON.stringify({
        classification: classification.level,
        timestamp: Date.now()
      })));

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        keyId: key.id,
        algorithm: key.algorithm,
        encryptedAt: new Date()
      };

      logger.info({
        keyId: key.id,
        algorithm: key.algorithm,
        dataLength: data.length,
        classification: classification.level
      }, 'Data encrypted successfully');

      return encryptedData;

    } catch (error) {
      logger.error({
        classification: classification.level,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Data encryption failed');

      throw new Error('Failed to encrypt data');
    }
  }

  async decryptData(encryptedData: EncryptedData): Promise<string> {
    try {
      const key = this.encryptionKeys.get(encryptedData.keyId);
      if (!key) {
        throw new Error('Encryption key not found');
      }

      if (key.status === 'compromised') {
        throw new Error('Encryption key has been compromised');
      }

      if (key.status === 'expired' && key.expiresAt < new Date()) {
        logger.warn({
          keyId: key.id,
          expiredAt: key.expiresAt.toISOString()
        }, 'Decrypting with expired key');
      }

      // Create decipher with GCM mode
      const decipher = crypto.createDecipher('aes-256-gcm', key.key);
      decipher.setAuthTag(Buffer.from(encryptedData.tag!, 'hex'));
      decipher.setAAD(Buffer.from(JSON.stringify({
        classification: 'phi', // Default for decryption
        timestamp: encryptedData.encryptedAt.getTime()
      })));

      // Decrypt data
      let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.info({
        keyId: key.id,
        algorithm: encryptedData.algorithm,
        encryptedAt: encryptedData.encryptedAt.toISOString()
      }, 'Data decrypted successfully');

      return decrypted;

    } catch (error) {
      logger.error({
        keyId: encryptedData.keyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Data decryption failed');

      throw new Error('Failed to decrypt data');
    }
  }

  async rotateEncryptionKey(): Promise<string> {
    try {
      // Generate new key
      const newKeyId = `key-${Date.now()}`;
      const newKey = crypto.randomBytes(32);

      const newEncryptionKey: EncryptionKey = {
        id: newKeyId,
        key: newKey,
        algorithm: 'aes-256-gcm',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.keyRotationInterval),
        status: 'active',
        rotationCount: 0
      };

      // Mark current key as expired
      const currentKey = this.encryptionKeys.get(this.currentKeyId);
      if (currentKey) {
        currentKey.status = 'expired';
        currentKey.expiresAt = new Date();
      }

      // Set new key as current
      this.encryptionKeys.set(newKeyId, newEncryptionKey);
      this.currentKeyId = newKeyId;

      logger.info({
        oldKeyId: this.currentKeyId,
        newKeyId,
        rotationCount: currentKey ? currentKey.rotationCount + 1 : 1
      }, 'Encryption key rotated successfully');

      return newKeyId;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Key rotation failed');

      throw new Error('Failed to rotate encryption key');
    }
  }

  async getDataClassification(dataType: string): Promise<DataClassification> {
    // Define classification rules based on data type
    const classifications: Record<string, DataClassification> = {
      'user_profile': {
        level: 'confidential',
        retentionPeriod: 2555, // 7 years
        encryptionRequired: true,
        accessLevel: 'authenticated'
      },
      'medical_history': {
        level: 'phi',
        retentionPeriod: 2555, // 7 years
        encryptionRequired: true,
        accessLevel: 'authorized'
      },
      'crisis_assessment': {
        level: 'phi',
        retentionPeriod: 2555, // 7 years
        encryptionRequired: true,
        accessLevel: 'authorized'
      },
      'communication_log': {
        level: 'phi',
        retentionPeriod: 2555, // 7 years
        encryptionRequired: true,
        accessLevel: 'authorized'
      },
      'audit_log': {
        level: 'restricted',
        retentionPeriod: 2190, // 6 years
        encryptionRequired: true,
        accessLevel: 'admin'
      },
      'system_config': {
        level: 'internal',
        retentionPeriod: 365,
        encryptionRequired: false,
        accessLevel: 'admin'
      },
      'public_content': {
        level: 'public',
        retentionPeriod: 365,
        encryptionRequired: false,
        accessLevel: 'public'
      }
    };

    return classifications[dataType] || {
      level: 'confidential',
      retentionPeriod: 2555,
      encryptionRequired: true,
      accessLevel: 'authenticated'
    };
  }

  async encryptField(data: string, fieldName: string): Promise<EncryptedData> {
    const classification = await this.getDataClassification(fieldName);
    return this.encryptData(data, classification);
  }

  async decryptField(encryptedData: EncryptedData): Promise<string> {
    return this.decryptData(encryptedData);
  }

  async encryptObject(obj: Record<string, any>, fieldsToEncrypt: string[]): Promise<Record<string, any>> {
    const encryptedObj = { ...obj };

    for (const field of fieldsToEncrypt) {
      if (encryptedObj[field] && typeof encryptedObj[field] === 'string') {
        const classification = await this.getDataClassification(field);
        if (classification.encryptionRequired) {
          encryptedObj[field] = await this.encryptData(encryptedObj[field], classification);
        }
      }
    }

    return encryptedObj;
  }

  async decryptObject(obj: Record<string, any>, fieldsToDecrypt: string[]): Promise<Record<string, any>> {
    const decryptedObj = { ...obj };

    for (const field of fieldsToDecrypt) {
      if (decryptedObj[field] && typeof decryptedObj[field] === 'object' && decryptedObj[field].ciphertext) {
        decryptedObj[field] = await this.decryptData(decryptedObj[field]);
      }
    }

    return decryptedObj;
  }

  getCurrentKeyStatus(): { keyId: string; expiresAt: Date; status: string } {
    const key = this.encryptionKeys.get(this.currentKeyId);
    if (!key) {
      throw new Error('No current encryption key found');
    }

    return {
      keyId: key.id,
      expiresAt: key.expiresAt,
      status: key.status
    };
  }

  getKeyRotationStatus(): { daysUntilExpiration: number; needsRotation: boolean } {
    const key = this.encryptionKeys.get(this.currentKeyId);
    if (!key) {
      return { daysUntilExpiration: 0, needsRotation: true };
    }

    const now = new Date();
    const daysUntilExpiration = Math.ceil((key.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    return {
      daysUntilExpiration: Math.max(0, daysUntilExpiration),
      needsRotation: daysUntilExpiration <= 30 // Rotate if 30 days or less remaining
    };
  }

  async validateEncryptionIntegrity(testData: string = 'HIPAA_ENCRYPTION_TEST'): Promise<boolean> {
    try {
      const classification = await this.getDataClassification('test_data');
      const encrypted = await this.encryptData(testData, classification);
      const decrypted = await this.decryptData(encrypted);

      const isValid = decrypted === testData;

      logger.info({
        testPassed: isValid,
        testDataLength: testData.length
      }, 'Encryption integrity validation completed');

      return isValid;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Encryption integrity validation failed');

      return false;
    }
  }

  // Emergency key compromise handling
  async compromiseKey(keyId: string, reason: string): Promise<void> {
    const key = this.encryptionKeys.get(keyId);
    if (!key) {
      throw new Error('Key not found');
    }

    key.status = 'compromised';

    // Immediately rotate to new key
    await this.rotateEncryptionKey();

    logger.warn({
      compromisedKeyId: keyId,
      reason,
      newKeyId: this.currentKeyId
    }, 'Encryption key compromised and rotated');
  }

  // Get encryption statistics for compliance reporting
  getEncryptionStats(): {
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    compromisedKeys: number;
    currentKeyId: string;
    lastRotation: Date;
  } {
    const keys = Array.from(this.encryptionKeys.values());
    const currentKey = this.encryptionKeys.get(this.currentKeyId);

    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.status === 'active').length,
      expiredKeys: keys.filter(k => k.status === 'expired').length,
      compromisedKeys: keys.filter(k => k.status === 'compromised').length,
      currentKeyId: this.currentKeyId,
      lastRotation: currentKey?.createdAt || new Date()
    };
  }
}