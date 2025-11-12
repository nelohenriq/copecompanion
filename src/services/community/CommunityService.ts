import { logger } from '@/lib/logger';

export interface UserProfile {
  userId: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  interests: string[];
  supportAreas: string[];
  anonymityLevel: 'anonymous' | 'pseudonymous' | 'identified';
  joinedAt: Date;
  lastActive: Date;
  isActive: boolean;
}

export interface SupportGroup {
  id: string;
  name: string;
  description: string;
  category: SupportGroupCategory;
  privacyLevel: 'public' | 'private' | 'invite-only';
  memberCount: number;
  maxMembers?: number;
  rules: string[];
  moderators: string[];
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
  tags: string[];
}

export interface CommunityPost {
  id: string;
  authorId: string;
  groupId?: string;
  title?: string;
  content: string;
  contentType: 'text' | 'image' | 'link' | 'poll';
  tags: string[];
  mood?: string;
  triggerWarnings: string[];
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  replies: number;
  isPinned: boolean;
  isModerated: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  metadata: Record<string, any>;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  parentId?: string; // For nested replies
  isModerated: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
}

export interface UserConnection {
  id: string;
  userId: string;
  connectedUserId: string;
  connectionType: 'friend' | 'mentor' | 'mentee' | 'peer_support';
  status: 'pending' | 'accepted' | 'blocked';
  initiatedBy: string;
  createdAt: Date;
  lastInteraction?: Date;
  trustLevel: number; // 0-1 scale
  sharedGoals: string[];
  mutualInterests: string[];
}

export interface PeerSupportSession {
  id: string;
  participants: string[];
  sessionType: 'one-on-one' | 'group' | 'crisis_support';
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  topics: string[];
  outcomes: string[];
  feedback: {
    participantId: string;
    rating: number; // 1-5
    comments?: string;
  }[];
  isAnonymous: boolean;
  moderatedBy?: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  eventType: 'workshop' | 'support_group' | 'social' | 'educational';
  startTime: Date;
  endTime: Date;
  maxParticipants?: number;
  currentParticipants: number;
  participants: string[];
  hostId: string;
  coHosts: string[];
  location: 'virtual' | 'in-person';
  meetingLink?: string;
  address?: string;
  tags: string[];
  prerequisites: string[];
  isPublic: boolean;
  createdAt: Date;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
}

export interface ModerationAction {
  id: string;
  moderatorId: string;
  targetType: 'post' | 'comment' | 'user' | 'group';
  targetId: string;
  action: 'approve' | 'reject' | 'flag' | 'ban' | 'warn' | 'delete';
  reason: string;
  duration?: number; // For temporary bans in hours
  createdAt: Date;
  expiresAt?: Date;
  appealed: boolean;
  appealResolved: boolean;
}

export type SupportGroupCategory =
  | 'anxiety'
  | 'depression'
  | 'ptsd'
  | 'ocd'
  | 'eating_disorders'
  | 'addiction'
  | 'grief'
  | 'relationships'
  | 'lgbtq'
  | 'general_wellbeing'
  | 'peer_support'
  | 'professional_guidance';

export class CommunityService {
  private users: Map<string, UserProfile> = new Map();
  private groups: Map<string, SupportGroup> = new Map();
  private posts: Map<string, CommunityPost> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private connections: Map<string, UserConnection[]> = new Map();
  private sessions: Map<string, PeerSupportSession> = new Map();
  private events: Map<string, CommunityEvent> = new Map();
  private moderationActions: Map<string, ModerationAction[]> = new Map();

  constructor() {
    this.initializeCommunityService();
  }

  private initializeCommunityService() {
    // Initialize default support groups
    this.createDefaultSupportGroups();
    // Create demo user profile
    this.createDemoUserProfile();
    logger.info('Community service initialized');
  }

  private createDefaultSupportGroups() {
    const defaultGroups: Omit<SupportGroup, 'id' | 'memberCount' | 'createdAt'>[] = [
      {
        name: 'Anxiety Support Circle',
        description: 'A safe space for sharing experiences and coping strategies related to anxiety.',
        category: 'anxiety',
        privacyLevel: 'public',
        rules: [
          'Be respectful and supportive',
          'No unsolicited advice unless asked',
          'Maintain confidentiality',
          'Use trigger warnings when appropriate'
        ],
        moderators: [],
        createdBy: 'system',
        isActive: true,
        tags: ['anxiety', 'support', 'coping']
      },
      {
        name: 'Depression Warriors',
        description: 'Connecting with others who understand the challenges of depression.',
        category: 'depression',
        privacyLevel: 'public',
        rules: [
          'Share your experiences openly',
          'Offer hope and understanding',
          'Respect different coping mechanisms',
          'Seek professional help when needed'
        ],
        moderators: [],
        createdBy: 'system',
        isActive: true,
        tags: ['depression', 'mental_health', 'recovery']
      },
      {
        name: 'Peer Support Network',
        description: 'General peer support for anyone needing to talk and connect.',
        category: 'peer_support',
        privacyLevel: 'public',
        rules: [
          'Everyone\'s experience is valid',
          'Listen actively and empathetically',
          'Share resources when helpful',
          'Respect boundaries and privacy'
        ],
        moderators: [],
        createdBy: 'system',
        isActive: true,
        tags: ['peer_support', 'community', 'listening']
      }
    ];

    for (const groupData of defaultGroups) {
      const group: SupportGroup = {
        ...groupData,
        id: this.generateGroupId(),
        memberCount: 0,
        createdAt: new Date()
      };
      this.groups.set(group.id, group);
    }
  }

  private createDemoUserProfile() {
    const demoProfile: UserProfile = {
      userId: 'user_demo',
      displayName: 'Demo User',
      bio: 'Exploring mental health support and community features',
      interests: ['mindfulness', 'peer_support', 'anxiety_management'],
      supportAreas: ['anxiety', 'general_wellbeing'],
      anonymityLevel: 'pseudonymous',
      joinedAt: new Date('2024-01-15'),
      lastActive: new Date(),
      isActive: true
    };

    this.users.set('user_demo', demoProfile);
  }

  async createUserProfile(profileData: Omit<UserProfile, 'joinedAt' | 'lastActive' | 'isActive'>): Promise<UserProfile> {
    try {
      const profile: UserProfile = {
        ...profileData,
        joinedAt: new Date(),
        lastActive: new Date(),
        isActive: true
      };

      this.users.set(profile.userId, profile);

      logger.info({
        userId: profile.userId,
        anonymityLevel: profile.anonymityLevel
      }, 'User profile created');

      return profile;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: profileData.userId
      }, 'Failed to create user profile');
      throw error;
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const profile = this.users.get(userId);
      if (!profile) return null;

      const updatedProfile: UserProfile = {
        ...profile,
        ...updates,
        lastActive: new Date()
      };

      this.users.set(userId, updatedProfile);

      logger.debug({ userId }, 'User profile updated');
      return updatedProfile;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to update user profile');
      return null;
    }
  }

  async createSupportGroup(groupData: Omit<SupportGroup, 'id' | 'memberCount' | 'createdAt'>): Promise<SupportGroup> {
    try {
      const group: SupportGroup = {
        ...groupData,
        id: this.generateGroupId(),
        memberCount: 0,
        createdAt: new Date()
      };

      this.groups.set(group.id, group);

      logger.info({
        groupId: group.id,
        category: group.category,
        privacyLevel: group.privacyLevel
      }, 'Support group created');

      return group;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        createdBy: groupData.createdBy
      }, 'Failed to create support group');
      throw error;
    }
  }

  async joinSupportGroup(userId: string, groupId: string): Promise<boolean> {
    try {
      const group = this.groups.get(groupId);
      if (!group || !group.isActive) return false;

      // Check privacy and membership limits
      if (group.privacyLevel === 'private' || group.privacyLevel === 'invite-only') {
        // In a real implementation, check invitations/approvals
        return false;
      }

      if (group.maxMembers && group.memberCount >= group.maxMembers) {
        return false;
      }

      group.memberCount += 1;
      this.groups.set(group.id, group);

      logger.info({
        userId,
        groupId,
        newMemberCount: group.memberCount
      }, 'User joined support group');

      return true;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        groupId
      }, 'Failed to join support group');
      return false;
    }
  }

  async createPost(postData: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'replies' | 'isModerated' | 'moderationStatus'>): Promise<CommunityPost> {
    try {
      // Content moderation check
      const moderationResult = await this.moderateContent(postData.content, postData.triggerWarnings);
      if (!moderationResult.approved) {
        throw new Error(`Post rejected: ${moderationResult.reason}`);
      }

      const post: CommunityPost = {
        ...postData,
        id: this.generatePostId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        likes: 0,
        replies: 0,
        isModerated: false,
        moderationStatus: 'approved'
      };

      this.posts.set(post.id, post);

      logger.info({
        postId: post.id,
        authorId: post.authorId,
        groupId: post.groupId,
        contentType: post.contentType
      }, 'Community post created');

      return post;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        authorId: postData.authorId
      }, 'Failed to create community post');
      throw error;
    }
  }

  async createComment(commentData: Omit<Comment, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'isModerated' | 'moderationStatus'>): Promise<Comment> {
    try {
      // Content moderation check
      const moderationResult = await this.moderateContent(commentData.content, []);
      if (!moderationResult.approved) {
        throw new Error(`Comment rejected: ${moderationResult.reason}`);
      }

      const comment: Comment = {
        ...commentData,
        id: this.generateCommentId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        likes: 0,
        isModerated: false,
        moderationStatus: 'approved'
      };

      const postComments = this.comments.get(comment.postId) || [];
      postComments.push(comment);
      this.comments.set(comment.postId, postComments);

      // Update post reply count
      const post = this.posts.get(comment.postId);
      if (post) {
        post.replies += 1;
        this.posts.set(post.id, post);
      }

      logger.debug({
        commentId: comment.id,
        postId: comment.postId,
        authorId: comment.authorId
      }, 'Comment created');

      return comment;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        authorId: commentData.authorId,
        postId: commentData.postId
      }, 'Failed to create comment');
      throw error;
    }
  }

  async createUserConnection(connectionData: Omit<UserConnection, 'id' | 'createdAt'>): Promise<UserConnection> {
    try {
      // Validate connection doesn't already exist
      const existingConnections = this.connections.get(connectionData.userId) || [];
      const existingConnection = existingConnections.find(
        c => c.connectedUserId === connectionData.connectedUserId
      );

      if (existingConnection) {
        throw new Error('Connection already exists');
      }

      const connection: UserConnection = {
        ...connectionData,
        id: this.generateConnectionId(),
        createdAt: new Date()
      };

      // Add to both users' connection lists
      const userConnections = this.connections.get(connectionData.userId) || [];
      userConnections.push(connection);
      this.connections.set(connectionData.userId, userConnections);

      // Create reciprocal connection
      const reciprocalConnection: UserConnection = {
        ...connection,
        userId: connectionData.connectedUserId,
        connectedUserId: connectionData.userId,
        status: 'pending' // Wait for acceptance
      };

      const connectedUserConnections = this.connections.get(connectionData.connectedUserId) || [];
      connectedUserConnections.push(reciprocalConnection);
      this.connections.set(connectionData.connectedUserId, connectedUserConnections);

      logger.info({
        connectionId: connection.id,
        userId: connection.userId,
        connectedUserId: connection.connectedUserId,
        connectionType: connection.connectionType
      }, 'User connection created');

      return connection;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: connectionData.userId,
        connectedUserId: connectionData.connectedUserId
      }, 'Failed to create user connection');
      throw error;
    }
  }

  async createPeerSupportSession(sessionData: Omit<PeerSupportSession, 'id'>): Promise<PeerSupportSession> {
    try {
      const session: PeerSupportSession = {
        ...sessionData,
        id: this.generateSessionId()
      };

      this.sessions.set(session.id, session);

      logger.info({
        sessionId: session.id,
        participants: session.participants.length,
        sessionType: session.sessionType
      }, 'Peer support session created');

      return session;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to create peer support session');
      throw error;
    }
  }

  async createCommunityEvent(eventData: Omit<CommunityEvent, 'id' | 'currentParticipants' | 'participants' | 'createdAt'>): Promise<CommunityEvent> {
    try {
      const event: CommunityEvent = {
        ...eventData,
        id: this.generateEventId(),
        currentParticipants: 0,
        participants: [],
        createdAt: new Date()
      };

      this.events.set(event.id, event);

      logger.info({
        eventId: event.id,
        title: event.title,
        eventType: event.eventType,
        startTime: event.startTime.toISOString()
      }, 'Community event created');

      return event;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        hostId: eventData.hostId
      }, 'Failed to create community event');
      throw error;
    }
  }

  private async moderateContent(content: string, triggerWarnings: string[]): Promise<{ approved: boolean; reason?: string }> {
    // Basic content moderation (in production, use advanced ML models)
    const prohibitedWords = ['harm', 'suicide', 'kill', 'die']; // Simplified
    const lowerContent = content.toLowerCase();

    for (const word of prohibitedWords) {
      if (lowerContent.includes(word) && !triggerWarnings.includes(word)) {
        return {
          approved: false,
          reason: `Content contains sensitive topic "${word}" without trigger warning`
        };
      }
    }

    // Check content length
    if (content.length > 10000) {
      return {
        approved: false,
        reason: 'Content exceeds maximum length'
      };
    }

    return { approved: true };
  }

  async performModerationAction(action: Omit<ModerationAction, 'id' | 'createdAt'>): Promise<ModerationAction> {
    try {
      const moderationAction: ModerationAction = {
        ...action,
        id: this.generateModerationId(),
        createdAt: new Date()
      };

      const targetActions = this.moderationActions.get(action.targetId) || [];
      targetActions.push(moderationAction);
      this.moderationActions.set(action.targetId, targetActions);

      // Apply the moderation action
      await this.applyModerationAction(moderationAction);

      logger.info({
        actionId: moderationAction.id,
        moderatorId: moderationAction.moderatorId,
        targetType: moderationAction.targetType,
        action: moderationAction.action
      }, 'Moderation action performed');

      return moderationAction;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        moderatorId: action.moderatorId
      }, 'Failed to perform moderation action');
      throw error;
    }
  }

  private async applyModerationAction(action: ModerationAction): Promise<void> {
    switch (action.targetType) {
      case 'post':
        const post = this.posts.get(action.targetId);
        if (post) {
          switch (action.action) {
            case 'approve':
              post.moderationStatus = 'approved';
              post.isModerated = true;
              break;
            case 'reject':
            case 'delete':
              post.moderationStatus = 'rejected';
              post.isModerated = true;
              // In production, would mark for deletion
              break;
            case 'flag':
              post.moderationStatus = 'flagged';
              break;
          }
          this.posts.set(post.id, post);
        }
        break;

      case 'comment':
        // Similar logic for comments
        break;

      case 'user':
        // User moderation (ban, warn, etc.)
        break;

      case 'group':
        // Group moderation
        break;
    }
  }

  // Utility methods
  private generateGroupId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePostId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConnectionId(): string {
    return `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateModerationId(): string {
    return `moderation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Data access methods
  getUserProfile(userId: string): UserProfile | null {
    return this.users.get(userId) || null;
  }

  getSupportGroup(groupId: string): SupportGroup | null {
    return this.groups.get(groupId) || null;
  }

  getSupportGroups(category?: SupportGroupCategory): SupportGroup[] {
    const groups = Array.from(this.groups.values());
    return category ? groups.filter(g => g.category === category) : groups;
  }

  getCommunityPosts(groupId?: string, limit: number = 50): CommunityPost[] {
    const posts = Array.from(this.posts.values())
      .filter(p => !groupId || p.groupId === groupId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return posts;
  }

  getPostComments(postId: string): Comment[] {
    return this.comments.get(postId) || [];
  }

  getUserConnections(userId: string): UserConnection[] {
    return this.connections.get(userId) || [];
  }

  getCommunityEvents(upcomingOnly: boolean = true): CommunityEvent[] {
    const events = Array.from(this.events.values());
    const now = new Date();

    return upcomingOnly
      ? events.filter(e => e.startTime > now && e.status === 'published')
      : events;
  }

  // Analytics methods
  getCommunityStats(): {
    totalUsers: number;
    totalGroups: number;
    totalPosts: number;
    totalComments: number;
    activeUsers: number;
    engagementRate: number;
  } {
    const totalUsers = this.users.size;
    const totalGroups = this.groups.size;
    const totalPosts = this.posts.size;
    const totalComments = Array.from(this.comments.values()).reduce((sum, comments) => sum + comments.length, 0);

    const activeUsers = Array.from(this.users.values())
      .filter(u => u.isActive && (Date.now() - u.lastActive.getTime()) < 7 * 24 * 60 * 60 * 1000).length;

    const engagementRate = totalUsers > 0 ? (totalPosts + totalComments) / totalUsers : 0;

    return {
      totalUsers,
      totalGroups,
      totalPosts,
      totalComments,
      activeUsers,
      engagementRate
    };
  }
}