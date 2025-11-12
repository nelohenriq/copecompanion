import { useState, useEffect, useCallback, useMemo } from 'react';
import { CommunityService, UserProfile, SupportGroup, CommunityPost, Comment, UserConnection, CommunityEvent } from '@/services/community/CommunityService';
import { PeerSupportService, SupportMatch, CrisisSupportRequest, SupportNetwork } from '@/services/community/PeerSupportService';
import { logger } from '@/lib/logger';

interface UseCommunityOptions {
  userId?: string;
  enabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // minutes
}

interface UseCommunityReturn {
  // Data
  profile: UserProfile | null;
  groups: SupportGroup[];
  posts: CommunityPost[];
  connections: UserConnection[];
  events: CommunityEvent[];
  supportMatches: SupportMatch[];
  supportNetwork: SupportNetwork | null;

  // State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Profile actions
  createProfile: (profileData: Omit<UserProfile, 'userId' | 'joinedAt' | 'lastActive' | 'isActive'>) => Promise<UserProfile | null>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile | null>;

  // Group actions
  createGroup: (groupData: {
    name: string;
    description: string;
    category: string;
    privacyLevel?: 'public' | 'private' | 'invite-only';
    rules?: string[];
    maxMembers?: number;
    tags?: string[];
  }) => Promise<SupportGroup | null>;
  joinGroup: (groupId: string) => Promise<boolean>;

  // Post actions
  createPost: (postData: {
    groupId?: string;
    title?: string;
    content: string;
    contentType?: 'text' | 'image' | 'link' | 'poll';
    tags?: string[];
    mood?: string;
    triggerWarnings?: string[];
    isAnonymous?: boolean;
  }) => Promise<CommunityPost | null>;
  createComment: (commentData: {
    postId: string;
    content: string;
    isAnonymous?: boolean;
  }) => Promise<Comment | null>;

  // Connection actions
  createConnection: (connectedUserId: string, connectionType?: 'friend' | 'mentor' | 'mentee' | 'peer_support') => Promise<UserConnection | null>;

  // Event actions
  createEvent: (eventData: {
    title: string;
    description: string;
    eventType?: 'workshop' | 'support_group' | 'social' | 'educational';
    startTime: Date;
    endTime: Date;
    maxParticipants?: number;
    location?: 'virtual' | 'in-person';
    meetingLink?: string;
    address?: string;
    tags?: string[];
    prerequisites?: string[];
    isPublic?: boolean;
  }) => Promise<CommunityEvent | null>;

  // Peer support actions
  findSupportMatches: (criteria?: {
    supportType?: string;
    urgency?: 'low' | 'medium' | 'high';
    topics?: string[];
    maxMatches?: number;
  }) => Promise<SupportMatch[]>;
  createCrisisRequest: (requestData: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    crisisType: string;
    description: string;
    immediateNeeds?: string[];
    preferredSupportType?: 'chat' | 'call' | 'in-person' | 'professional';
    location?: {
      type: 'virtual' | 'physical';
      details?: string;
    };
  }) => Promise<CrisisSupportRequest | null>;
  buildSupportNetwork: () => Promise<SupportNetwork | null>;

  // Utility actions
  refreshData: () => Promise<void>;
  clearError: () => void;

  // Computed values
  joinedGroups: SupportGroup[];
  availableGroups: SupportGroup[];
  recentPosts: CommunityPost[];
  upcomingEvents: CommunityEvent[];
  activeConnections: UserConnection[];
  pendingConnections: UserConnection[];
}

export function useCommunity(options: UseCommunityOptions = {}): UseCommunityReturn {
  const {
    userId,
    enabled = true,
    autoRefresh = true,
    refreshInterval = 30 // 30 minutes
  } = options;

  // State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<SupportGroup[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [connections, setConnections] = useState<UserConnection[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [supportMatches, setSupportMatches] = useState<SupportMatch[]>([]);
  const [supportNetwork, setSupportNetwork] = useState<SupportNetwork | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Service instances (client-side only)
  const communityService = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new CommunityService();
  }, []);

  const peerSupportService = useMemo(() => {
    if (typeof window === 'undefined' || !communityService) return null;
    return new PeerSupportService(communityService);
  }, [communityService]);

  // Fetch all community data
  const fetchData = useCallback(async () => {
    if (!enabled || !userId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch data in parallel
      const [profileData, groupsData, postsData, connectionsData, eventsData] = await Promise.all([
        fetch(`/api/community?action=get_profile&userId=${userId}`).then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/community?action=get_groups').then(r => r.json()),
        fetch('/api/community?action=get_posts&limit=50').then(r => r.json()),
        fetch(`/api/community?action=get_connections&userId=${userId}`).then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/community?action=get_events').then(r => r.json())
      ]);

      if (profileData.success) setProfile(profileData.profile);
      if (groupsData.success) setGroups(groupsData.groups || []);
      if (postsData.success) setPosts(postsData.posts || []);
      if (connectionsData.success) setConnections(connectionsData.connections || []);
      if (eventsData.success) setEvents(eventsData.events || []);

      // Fetch peer support data
      try {
        const [matchesData, networkData] = await Promise.all([
          fetch(`/api/community?action=get_support_matches&userId=${userId}`).then(r => r.json()).catch(() => ({ success: false })),
          fetch(`/api/community?action=get_support_network&userId=${userId}`).then(r => r.json()).catch(() => ({ success: false }))
        ]);

        if (matchesData.success) setSupportMatches(matchesData.matches || []);
        if (networkData.success) setSupportNetwork(networkData.network);
      } catch (peerError) {
        // Peer support data is optional, don't fail the whole fetch
        logger.debug({ userId, error: peerError }, 'Failed to fetch peer support data');
      }

      setLastUpdated(new Date());

      logger.debug({
        userId,
        groupsCount: groupsData.groups?.length || 0,
        postsCount: postsData.posts?.length || 0,
        connectionsCount: connectionsData.connections?.length || 0
      }, 'Community data fetched');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to fetch community data');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId]);

  // Create user profile
  const createProfile = useCallback(async (
    profileData: Omit<UserProfile, 'userId' | 'joinedAt' | 'lastActive' | 'isActive'>
  ): Promise<UserProfile | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_profile',
          userId,
          ...profileData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setProfile(result.profile);
        logger.info({ userId }, 'Profile created successfully');
        return result.profile;
      } else {
        throw new Error(result.error || 'Failed to create profile');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to create profile');
      return null;
    }
  }, [enabled, userId]);

  // Update user profile
  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          userId,
          updates
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setProfile(result.profile);
        logger.debug({ userId }, 'Profile updated successfully');
        return result.profile;
      } else {
        throw new Error(result.error || 'Failed to update profile');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to update profile');
      return null;
    }
  }, [enabled, userId]);

  // Create support group
  const createGroup = useCallback(async (groupData: any): Promise<SupportGroup | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_group',
          ...groupData,
          createdBy: userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh groups
        logger.info({ userId, groupId: result.group.id }, 'Group created successfully');
        return result.group;
      } else {
        throw new Error(result.error || 'Failed to create group');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to create group');
      return null;
    }
  }, [enabled, userId, fetchData]);

  // Join support group
  const joinGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!enabled || !userId) return false;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join_group',
          userId,
          groupId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh groups
        logger.info({ userId, groupId }, 'Joined group successfully');
        return true;
      } else {
        throw new Error(result.error || 'Failed to join group');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId,
        groupId
      }, 'Failed to join group');
      return false;
    }
  }, [enabled, userId, fetchData]);

  // Create post
  const createPost = useCallback(async (postData: any): Promise<CommunityPost | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_post',
          authorId: userId,
          ...postData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh posts
        logger.debug({ userId, postId: result.post.id }, 'Post created successfully');
        return result.post;
      } else {
        throw new Error(result.error || 'Failed to create post');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to create post');
      return null;
    }
  }, [enabled, userId, fetchData]);

  // Create comment
  const createComment = useCallback(async (commentData: any): Promise<Comment | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_comment',
          authorId: userId,
          ...commentData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh posts/comments
        logger.debug({ userId, commentId: result.comment.id }, 'Comment created successfully');
        return result.comment;
      } else {
        throw new Error(result.error || 'Failed to create comment');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to create comment');
      return null;
    }
  }, [enabled, userId, fetchData]);

  // Create connection
  const createConnection = useCallback(async (
    connectedUserId: string,
    connectionType: 'friend' | 'mentor' | 'mentee' | 'peer_support' = 'peer_support'
  ): Promise<UserConnection | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_connection',
          userId,
          connectedUserId,
          connectionType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh connections
        logger.info({ userId, connectedUserId, connectionType }, 'Connection created successfully');
        return result.connection;
      } else {
        throw new Error(result.error || 'Failed to create connection');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId,
        connectedUserId
      }, 'Failed to create connection');
      return null;
    }
  }, [enabled, userId, fetchData]);

  // Create event
  const createEvent = useCallback(async (eventData: any): Promise<CommunityEvent | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_event',
          hostId: userId,
          ...eventData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchData(); // Refresh events
        logger.info({ userId, eventId: result.event.id }, 'Event created successfully');
        return result.event;
      } else {
        throw new Error(result.error || 'Failed to create event');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to create event');
      return null;
    }
  }, [enabled, userId, fetchData]);

  // Find support matches
  const findSupportMatches = useCallback(async (criteria?: any): Promise<SupportMatch[]> => {
    if (!enabled || !userId) return [];

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'find_support_matches',
          userId,
          ...criteria
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setSupportMatches(result.matches);
        logger.info({ userId, matchesFound: result.matches.length }, 'Support matches found');
        return result.matches;
      } else {
        throw new Error(result.error || 'Failed to find support matches');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to find support matches');
      return [];
    }
  }, [enabled, userId]);

  // Create crisis request
  const createCrisisRequest = useCallback(async (requestData: any): Promise<CrisisSupportRequest | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_crisis_request',
          userId,
          ...requestData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        logger.warn({ userId, requestId: result.crisisRequest.id }, 'Crisis request created successfully');
        return result.crisisRequest;
      } else {
        throw new Error(result.error || 'Failed to create crisis request');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to create crisis request');
      return null;
    }
  }, [enabled, userId]);

  // Build support network
  const buildSupportNetwork = useCallback(async (): Promise<SupportNetwork | null> => {
    if (!enabled || !userId) return null;

    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'build_support_network',
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setSupportNetwork(result.network);
        logger.info({ userId, networkStrength: result.network.networkStrength }, 'Support network built');
        return result.network;
      } else {
        throw new Error(result.error || 'Failed to build support network');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      logger.error({
        error: errorMessage,
        userId
      }, 'Failed to build support network');
      return null;
    }
  }, [enabled, userId]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (!enabled || !autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds

    return () => clearInterval(interval);
  }, [enabled, autoRefresh, refreshInterval, fetchData]);

  // Initial load
  useEffect(() => {
    if (enabled && userId) {
      fetchData();
    }
  }, [enabled, userId]); // Remove fetchData from deps to avoid infinite loop

  // Computed values
  const joinedGroups = useMemo(() =>
    groups.filter(g => g.memberCount > 0), // Simplified - in reality would check user's membership
    [groups]
  );

  const availableGroups = useMemo(() =>
    groups.filter(g => g.isActive && g.privacyLevel === 'public'),
    [groups]
  );

  const recentPosts = useMemo(() =>
    posts
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20),
    [posts]
  );

  const upcomingEvents = useMemo(() =>
    events
      .filter(e => e.startTime > new Date() && e.status === 'published')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [events]
  );

  const activeConnections = useMemo(() =>
    connections.filter(c => c.status === 'accepted'),
    [connections]
  );

  const pendingConnections = useMemo(() =>
    connections.filter(c => c.status === 'pending'),
    [connections]
  );

  return {
    profile,
    groups,
    posts,
    connections,
    events,
    supportMatches,
    supportNetwork,
    isLoading,
    error,
    lastUpdated,
    createProfile,
    updateProfile,
    createGroup,
    joinGroup,
    createPost,
    createComment,
    createConnection,
    createEvent,
    findSupportMatches,
    createCrisisRequest,
    buildSupportNetwork,
    refreshData,
    clearError,
    joinedGroups,
    availableGroups,
    recentPosts,
    upcomingEvents,
    activeConnections,
    pendingConnections
  };
}

// Specialized hook for peer support
export function usePeerSupport(userId: string) {
  const community = useCommunity({ userId });

  const requestSupport = useCallback(async (urgency: 'low' | 'medium' | 'high', topics: string[]) => {
    return community.findSupportMatches({ urgency, topics });
  }, [community]);

  const emergencySupport = useCallback(async (crisisType: string, description: string) => {
    return community.createCrisisRequest({
      severity: 'high',
      crisisType,
      description,
      preferredSupportType: 'chat'
    });
  }, [community]);

  return {
    ...community,
    requestSupport,
    emergencySupport
  };
}

// Hook for community moderation
export function useCommunityModeration(userId: string) {
  const [moderationActions, setModerationActions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const performModeration = useCallback(async (
    targetType: 'post' | 'comment' | 'user' | 'group',
    targetId: string,
    action: 'approve' | 'reject' | 'flag' | 'ban' | 'warn' | 'delete',
    reason: string
  ) => {
    try {
      setIsLoading(true);

      // In a real implementation, this would call a moderation API
      const moderationAction = {
        id: `mod_${Date.now()}`,
        moderatorId: userId,
        targetType,
        targetId,
        action,
        reason,
        createdAt: new Date()
      };

      setModerationActions(prev => [...prev, moderationAction]);

      logger.info({
        moderatorId: userId,
        targetType,
        targetId,
        action
      }, 'Moderation action performed');

      return moderationAction;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'Failed to perform moderation action');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    moderationActions,
    isLoading,
    performModeration
  };
}