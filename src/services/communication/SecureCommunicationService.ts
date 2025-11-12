import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface CommunicationChannel {
  id: string;
  type: 'realtime' | 'sms' | 'email' | 'push';
  status: 'active' | 'inactive' | 'error';
  encryption: {
    algorithm: string;
    keyId: string;
    lastRotated: Date;
  };
  participants: CommunicationParticipant[];
  metadata: {
    crisisId?: string;
    escalationId?: string;
    professionalId?: string;
    userId?: string;
    createdAt: Date;
    expiresAt?: Date;
  };
  audit: CommunicationAudit[];
}

export interface CommunicationParticipant {
  id: string;
  type: 'professional' | 'user' | 'system';
  contactInfo: {
    email?: string;
    sms?: string;
    pushToken?: string;
    socketId?: string;
  };
  permissions: CommunicationPermission[];
  joinedAt: Date;
  lastActivity: Date;
}

export interface CommunicationPermission {
  action: 'send' | 'receive' | 'moderate' | 'end';
  allowed: boolean;
}

export interface CommunicationMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderType: 'professional' | 'user' | 'system';
  content: EncryptedContent;
  timestamp: Date;
  messageType: 'text' | 'system' | 'file' | 'crisis_update';
  metadata: {
    priority: 'normal' | 'urgent' | 'critical';
    requiresAcknowledgment: boolean;
    acknowledgedBy?: string[];
  };
}

export interface EncryptedContent {
  ciphertext: string;
  iv: string;
  tag?: string;
  keyId: string;
}

export interface CommunicationAudit {
  id: string;
  timestamp: Date;
  action: 'message_sent' | 'message_received' | 'channel_created' | 'channel_joined' | 'channel_left' | 'permission_changed';
  actorId: string;
  actorType: 'professional' | 'user' | 'system';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface CommunicationSession {
  id: string;
  channelId: string;
  professionalId: string;
  userId: string;
  status: 'active' | 'ended' | 'transferred';
  startedAt: Date;
  endedAt?: Date;
  messageCount: number;
  lastActivity: Date;
  quality: {
    professionalResponseTime: number; // average in seconds
    userSatisfaction?: number;
    technicalIssues: number;
  };
}

export class SecureCommunicationService {
  private channels: Map<string, CommunicationChannel> = new Map();
  private sessions: Map<string, CommunicationSession> = new Map();
  private encryptionKeys: Map<string, { key: Buffer; createdAt: Date }> = new Map();

  constructor() {
    this.initializeEncryptionKeys();
  }

  private initializeEncryptionKeys() {
    // Generate initial encryption keys for HIPAA compliance
    const keyId = `key-${Date.now()}`;
    const key = crypto.randomBytes(32); // 256-bit key for AES-256-GCM

    this.encryptionKeys.set(keyId, {
      key,
      createdAt: new Date()
    });

    logger.info({
      keyId,
      algorithm: 'AES-256-GCM'
    }, 'Encryption keys initialized for secure communication');
  }

  async createCommunicationChannel(
    professionalId: string,
    userId: string,
    crisisId: string,
    escalationId: string
  ): Promise<CommunicationChannel> {
    try {
      const channelId = `channel-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const keyId = Array.from(this.encryptionKeys.keys())[0]; // Use latest key

      const channel: CommunicationChannel = {
        id: channelId,
        type: 'realtime',
        status: 'active',
        encryption: {
          algorithm: 'AES-256-GCM',
          keyId,
          lastRotated: new Date()
        },
        participants: [
          {
            id: professionalId,
            type: 'professional',
            contactInfo: {}, // Will be populated from professional data
            permissions: [
              { action: 'send', allowed: true },
              { action: 'receive', allowed: true },
              { action: 'moderate', allowed: true },
              { action: 'end', allowed: true }
            ],
            joinedAt: new Date(),
            lastActivity: new Date()
          },
          {
            id: userId,
            type: 'user',
            contactInfo: {}, // Will be populated from user data
            permissions: [
              { action: 'send', allowed: true },
              { action: 'receive', allowed: true },
              { action: 'moderate', allowed: false },
              { action: 'end', allowed: false }
            ],
            joinedAt: new Date(),
            lastActivity: new Date()
          }
        ],
        metadata: {
          crisisId,
          escalationId,
          professionalId,
          userId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
        },
        audit: [
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date(),
            action: 'channel_created',
            actorId: 'system',
            actorType: 'system',
            details: { channelId, professionalId, userId, crisisId }
          }
        ]
      };

      this.channels.set(channelId, channel);

      // Create communication session
      await this.createCommunicationSession(channelId, professionalId, userId);

      logger.info({
        channelId,
        professionalId,
        userId,
        crisisId
      }, 'Secure communication channel created');

      return channel;

    } catch (error) {
      logger.error({
        professionalId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to create communication channel');

      throw new Error('Failed to create secure communication channel');
    }
  }

  private async createCommunicationSession(
    channelId: string,
    professionalId: string,
    userId: string
  ): Promise<CommunicationSession> {
    const sessionId = `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const session: CommunicationSession = {
      id: sessionId,
      channelId,
      professionalId,
      userId,
      status: 'active',
      startedAt: new Date(),
      messageCount: 0,
      lastActivity: new Date(),
      quality: {
        professionalResponseTime: 0,
        technicalIssues: 0
      }
    };

    this.sessions.set(sessionId, session);

    logger.info({
      sessionId,
      channelId,
      professionalId,
      userId
    }, 'Communication session created');

    return session;
  }

  async sendMessage(
    channelId: string,
    senderId: string,
    senderType: 'professional' | 'user',
    content: string,
    messageType: CommunicationMessage['messageType'] = 'text',
    priority: CommunicationMessage['metadata']['priority'] = 'normal'
  ): Promise<CommunicationMessage> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel || channel.status !== 'active') {
        throw new Error('Communication channel not found or inactive');
      }

      // Verify sender permissions
      const sender = channel.participants.find(p => p.id === senderId);
      if (!sender || !sender.permissions.find(p => p.action === 'send')?.allowed) {
        throw new Error('Sender does not have permission to send messages');
      }

      // Encrypt message content
      const encryptedContent = await this.encryptContent(content, channel.encryption.keyId);

      const message: CommunicationMessage = {
        id: `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        channelId,
        senderId,
        senderType,
        content: encryptedContent,
        timestamp: new Date(),
        messageType,
        metadata: {
          priority,
          requiresAcknowledgment: priority === 'critical',
          acknowledgedBy: []
        }
      };

      // Update session activity
      const session = Array.from(this.sessions.values()).find(s => s.channelId === channelId);
      if (session) {
        session.messageCount++;
        session.lastActivity = new Date();

        // Track response time for professionals
        if (senderType === 'professional') {
          // This would track response time metrics
        }
      }

      // Add audit entry
      channel.audit.push({
        id: `audit-${Date.now()}`,
        timestamp: new Date(),
        action: 'message_sent',
        actorId: senderId,
        actorType: senderType,
        details: {
          messageId: message.id,
          messageType,
          priority,
          contentLength: content.length
        }
      });

      // Update participant activity
      const participant = channel.participants.find(p => p.id === senderId);
      if (participant) {
        participant.lastActivity = new Date();
      }

      logger.info({
        messageId: message.id,
        channelId,
        senderId,
        senderType,
        messageType,
        priority
      }, 'Secure message sent');

      return message;

    } catch (error) {
      logger.error({
        channelId,
        senderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to send secure message');

      throw error;
    }
  }

  async decryptMessage(message: CommunicationMessage): Promise<string> {
    try {
      return await this.decryptContent(message.content);
    } catch (error) {
      logger.error({
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to decrypt message');

      throw new Error('Failed to decrypt message content');
    }
  }

  private async encryptContent(content: string, keyId: string): Promise<EncryptedContent> {
    const keyData = this.encryptionKeys.get(keyId);
    if (!keyData) {
      throw new Error('Encryption key not found');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', keyData.key);

    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      keyId
    };
  }

  private async decryptContent(encryptedContent: EncryptedContent): Promise<string> {
    const keyData = this.encryptionKeys.get(encryptedContent.keyId);
    if (!keyData) {
      throw new Error('Decryption key not found');
    }

    const decipher = crypto.createDecipher('aes-256-gcm', keyData.key);
    decipher.setAuthTag(Buffer.from(encryptedContent.tag!, 'hex'));
    decipher.setAAD(Buffer.from(encryptedContent.iv, 'hex'));

    let decrypted = decipher.update(encryptedContent.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async endCommunicationSession(sessionId: string, reason: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) return false;

      session.status = 'ended';
      session.endedAt = new Date();

      // End associated channel
      const channel = this.channels.get(session.channelId);
      if (channel) {
        channel.status = 'inactive';
        channel.metadata.expiresAt = new Date();

        // Add audit entry
        channel.audit.push({
          id: `audit-${Date.now()}`,
          timestamp: new Date(),
          action: 'channel_left',
          actorId: 'system',
          actorType: 'system',
          details: { sessionId, reason, endedBy: 'system' }
        });
      }

      logger.info({
        sessionId,
        channelId: session.channelId,
        reason,
        duration: session.endedAt.getTime() - session.startedAt.getTime()
      }, 'Communication session ended');

      return true;

    } catch (error) {
      logger.error({
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to end communication session');

      return false;
    }
  }

  async getChannelAudit(channelId: string): Promise<CommunicationAudit[]> {
    const channel = this.channels.get(channelId);
    return channel?.audit || [];
  }

  async getSessionQualityMetrics(sessionId: string): Promise<CommunicationSession['quality'] | null> {
    const session = this.sessions.get(sessionId);
    return session?.quality || null;
  }

  getActiveChannels(): CommunicationChannel[] {
    return Array.from(this.channels.values()).filter(channel => channel.status === 'active');
  }

  getActiveSessions(): CommunicationSession[] {
    return Array.from(this.sessions.values()).filter(session => session.status === 'active');
  }

  // HIPAA compliance: Key rotation
  async rotateEncryptionKeys(): Promise<void> {
    const newKeyId = `key-${Date.now()}`;
    const newKey = crypto.randomBytes(32);

    this.encryptionKeys.set(newKeyId, {
      key: newKey,
      createdAt: new Date()
    });

    // Update active channels to use new key
    for (const channel of this.channels.values()) {
      if (channel.status === 'active') {
        channel.encryption.keyId = newKeyId;
        channel.encryption.lastRotated = new Date();
      }
    }

    logger.info({
      newKeyId,
      activeChannelsUpdated: this.getActiveChannels().length
    }, 'Encryption keys rotated for HIPAA compliance');
  }

  // Emergency override for system administrators
  async emergencyChannelAccess(channelId: string, adminId: string): Promise<boolean> {
    try {
      const channel = this.channels.get(channelId);
      if (!channel) return false;

      // Add admin as participant with full permissions
      const adminParticipant: CommunicationParticipant = {
        id: adminId,
        type: 'system',
        contactInfo: {},
        permissions: [
          { action: 'send', allowed: true },
          { action: 'receive', allowed: true },
          { action: 'moderate', allowed: true },
          { action: 'end', allowed: true }
        ],
        joinedAt: new Date(),
        lastActivity: new Date()
      };

      channel.participants.push(adminParticipant);

      // Add audit entry
      channel.audit.push({
        id: `audit-${Date.now()}`,
        timestamp: new Date(),
        action: 'channel_joined',
        actorId: adminId,
        actorType: 'system',
        details: { emergencyAccess: true, grantedBy: 'system' }
      });

      logger.warn({
        channelId,
        adminId
      }, 'Emergency channel access granted');

      return true;

    } catch (error) {
      logger.error({
        channelId,
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Emergency channel access failed');

      return false;
    }
  }
}