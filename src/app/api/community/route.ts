import { NextRequest, NextResponse } from 'next/server';
import { CommunityService } from '@/services/community/CommunityService';
import { PeerSupportService } from '@/services/community/PeerSupportService';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validation schemas
const createProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  displayName: z.string().min(1, 'Display name is required'),
  bio: z.string().optional(),
  interests: z.array(z.string()).default([]),
  supportAreas: z.array(z.string()).default([]),
  anonymityLevel: z.enum(['anonymous', 'pseudonymous', 'identified']).default('pseudonymous')
});

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  description: z.string().min(1, 'Group description is required'),
  category: z.enum([
    'anxiety', 'depression', 'ptsd', 'ocd', 'eating_disorders',
    'addiction', 'grief', 'relationships', 'lgbtq', 'general_wellbeing',
    'peer_support', 'professional_guidance'
  ]),
  privacyLevel: z.enum(['public', 'private', 'invite-only']).default('public'),
  rules: z.array(z.string()).default([]),
  maxMembers: z.number().positive().optional(),
  tags: z.array(z.string()).default([])
});

const createPostSchema = z.object({
  authorId: z.string().min(1, 'Author ID is required'),
  groupId: z.string().optional(),
  title: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  contentType: z.enum(['text', 'image', 'link', 'poll']).default('text'),
  tags: z.array(z.string()).default([]),
  mood: z.string().optional(),
  triggerWarnings: z.array(z.string()).default([]),
  isAnonymous: z.boolean().default(false)
});

const createCommentSchema = z.object({
  postId: z.string().min(1, 'Post ID is required'),
  authorId: z.string().min(1, 'Author ID is required'),
  content: z.string().min(1, 'Content is required'),
  isAnonymous: z.boolean().default(false)
});

const createConnectionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  connectedUserId: z.string().min(1, 'Connected user ID is required'),
  connectionType: z.enum(['friend', 'mentor', 'mentee', 'peer_support']).default('peer_support'),
  message: z.string().optional()
});

const createEventSchema = z.object({
  title: z.string().min(1, 'Event title is required'),
  description: z.string().min(1, 'Event description is required'),
  eventType: z.enum(['workshop', 'support_group', 'social', 'educational']).default('support_group'),
  startTime: z.string().datetime('Start time must be a valid ISO date'),
  endTime: z.string().datetime('End time must be a valid ISO date'),
  maxParticipants: z.number().positive().optional(),
  location: z.enum(['virtual', 'in-person']).default('virtual'),
  meetingLink: z.string().url().optional(),
  address: z.string().optional(),
  tags: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true)
});

const supportMatchSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  supportType: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high']).optional(),
  topics: z.array(z.string()).optional(),
  maxMatches: z.number().positive().default(5)
});

const crisisRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  crisisType: z.string().min(1, 'Crisis type is required'),
  description: z.string().min(1, 'Description is required'),
  immediateNeeds: z.array(z.string()).default([]),
  preferredSupportType: z.enum(['chat', 'call', 'in-person', 'professional']).default('chat'),
  location: z.object({
    type: z.enum(['virtual', 'physical']),
    details: z.string().optional()
  }).optional()
});

const sessionFeedbackSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  giverId: z.string().min(1, 'Giver ID is required'),
  receiverId: z.string().min(1, 'Receiver ID is required'),
  rating: z.number().min(1).max(5, 'Rating must be between 1 and 5'),
  categories: z.object({
    empathy: z.number().min(1).max(5),
    helpfulness: z.number().min(1).max(5),
    activeListening: z.number().min(1).max(5),
    appropriateAdvice: z.number().min(1).max(5),
    safety: z.number().min(1).max(5)
  }),
  comments: z.string().optional(),
  wouldRecommend: z.boolean().default(true)
});

const communityService = new CommunityService();
const peerSupportService = new PeerSupportService(communityService);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create_profile': {
        const validationResult = createProfileSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const profile = await communityService.createUserProfile(validationResult.data);

        logger.info({
          userId: profile.userId,
          anonymityLevel: profile.anonymityLevel
        }, 'User profile created via API');

        return NextResponse.json({
          success: true,
          profile: {
            userId: profile.userId,
            displayName: profile.displayName,
            anonymityLevel: profile.anonymityLevel,
            joinedAt: profile.joinedAt
          }
        });
      }

      case 'create_group': {
        const validationResult = createGroupSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const groupData = {
          ...validationResult.data,
          createdBy: data.createdBy || 'system',
          moderators: data.moderators || [],
          isActive: true
        };

        const group = await communityService.createSupportGroup(groupData);

        logger.info({
          groupId: group.id,
          category: group.category,
          privacyLevel: group.privacyLevel
        }, 'Support group created via API');

        return NextResponse.json({
          success: true,
          group: {
            id: group.id,
            name: group.name,
            category: group.category,
            privacyLevel: group.privacyLevel,
            memberCount: group.memberCount,
            createdAt: group.createdAt
          }
        });
      }

      case 'join_group': {
        const { userId, groupId } = data;

        if (!userId || !groupId) {
          return NextResponse.json(
            { error: 'User ID and Group ID are required' },
            { status: 400 }
          );
        }

        const success = await communityService.joinSupportGroup(userId, groupId);

        if (!success) {
          return NextResponse.json(
            { error: 'Failed to join group - may be full, private, or not found' },
            { status: 400 }
          );
        }

        logger.info({ userId, groupId }, 'User joined support group via API');

        return NextResponse.json({
          success: true,
          message: 'Successfully joined group'
        });
      }

      case 'create_post': {
        const validationResult = createPostSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const postData = {
          ...validationResult.data,
          isPinned: false,
          metadata: {}
        };

        const post = await communityService.createPost(postData);

        logger.info({
          postId: post.id,
          authorId: post.authorId,
          contentType: post.contentType
        }, 'Community post created via API');

        return NextResponse.json({
          success: true,
          post: {
            id: post.id,
            authorId: post.authorId,
            contentType: post.contentType,
            createdAt: post.createdAt,
            moderationStatus: post.moderationStatus
          }
        });
      }

      case 'create_comment': {
        const validationResult = createCommentSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const comment = await communityService.createComment(validationResult.data);

        logger.info({
          commentId: comment.id,
          postId: comment.postId,
          authorId: comment.authorId
        }, 'Comment created via API');

        return NextResponse.json({
          success: true,
          comment: {
            id: comment.id,
            postId: comment.postId,
            authorId: comment.authorId,
            createdAt: comment.createdAt,
            moderationStatus: comment.moderationStatus
          }
        });
      }

      case 'create_connection': {
        const validationResult = createConnectionSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const connectionData = {
          ...validationResult.data,
          status: 'pending' as const,
          initiatedBy: validationResult.data.userId,
          trustLevel: 0.5,
          sharedGoals: [],
          mutualInterests: []
        };

        const connection = await communityService.createUserConnection(connectionData);

        logger.info({
          connectionId: connection.id,
          userId: connection.userId,
          connectedUserId: connection.connectedUserId,
          connectionType: connection.connectionType
        }, 'User connection created via API');

        return NextResponse.json({
          success: true,
          connection: {
            id: connection.id,
            userId: connection.userId,
            connectedUserId: connection.connectedUserId,
            connectionType: connection.connectionType,
            status: connection.status,
            createdAt: connection.createdAt
          }
        });
      }

      case 'create_event': {
        const validationResult = createEventSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const eventData = {
          ...validationResult.data,
          hostId: data.hostId || 'system',
          coHosts: data.coHosts || [],
          startTime: new Date(validationResult.data.startTime),
          endTime: new Date(validationResult.data.endTime),
          status: 'published' as const
        };

        const event = await communityService.createCommunityEvent(eventData);

        logger.info({
          eventId: event.id,
          title: event.title,
          eventType: event.eventType,
          startTime: event.startTime.toISOString()
        }, 'Community event created via API');

        return NextResponse.json({
          success: true,
          event: {
            id: event.id,
            title: event.title,
            eventType: event.eventType,
            startTime: event.startTime,
            endTime: event.endTime,
            status: event.status,
            createdAt: event.createdAt
          }
        });
      }

      case 'find_support_matches': {
        const validationResult = supportMatchSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const matches = await peerSupportService.findSupportMatches(
          validationResult.data.userId,
          validationResult.data
        );

        logger.info({
          userId: validationResult.data.userId,
          matchesFound: matches.length
        }, 'Support matches found via API');

        return NextResponse.json({
          success: true,
          matches: matches.map(match => ({
            matchedUserId: match.matchedUserId,
            matchScore: match.matchScore,
            matchReasons: match.matchReasons,
            recommendedSessionType: match.recommendedSessionType,
            confidence: match.confidence
          }))
        });
      }

      case 'create_crisis_request': {
        const validationResult = crisisRequestSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const crisisRequest = await peerSupportService.createCrisisSupportRequest(validationResult.data);

        logger.warn({
          requestId: crisisRequest.id,
          userId: crisisRequest.userId,
          severity: crisisRequest.severity
        }, 'Crisis support request created via API');

        return NextResponse.json({
          success: true,
          crisisRequest: {
            id: crisisRequest.id,
            userId: crisisRequest.userId,
            severity: crisisRequest.severity,
            status: crisisRequest.status,
            createdAt: crisisRequest.createdAt,
            assignedSupporters: crisisRequest.assignedSupporters
          }
        });
      }

      case 'submit_feedback': {
        const validationResult = sessionFeedbackSchema.safeParse(data);
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: validationResult.error.issues },
            { status: 400 }
          );
        }

        const feedback = await peerSupportService.submitSessionFeedback(validationResult.data);

        logger.info({
          sessionId: feedback.sessionId,
          rating: feedback.rating
        }, 'Session feedback submitted via API');

        return NextResponse.json({
          success: true,
          feedback: {
            sessionId: feedback.sessionId,
            giverId: feedback.giverId,
            receiverId: feedback.receiverId,
            rating: feedback.rating,
            createdAt: feedback.createdAt
          }
        });
      }

      case 'build_support_network': {
        const { userId } = data;

        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        const network = await peerSupportService.buildSupportNetwork(userId);

        logger.info({
          userId,
          connectionsCount: network.connections.length,
          networkStrength: network.networkStrength
        }, 'Support network built via API');

        return NextResponse.json({
          success: true,
          network: {
            userId: network.userId,
            networkType: network.networkType,
            connectionsCount: network.connections.length,
            networkStrength: network.networkStrength,
            diversityScore: network.diversityScore,
            lastUpdated: network.lastUpdated
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: create_profile, create_group, join_group, create_post, create_comment, create_connection, create_event, find_support_matches, create_crisis_request, submit_feedback, build_support_network' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to process community API request');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process community request'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'get_groups';

    switch (action) {
      case 'get_groups': {
        const category = searchParams.get('category') as any;
        const groups = communityService.getSupportGroups(category);

        return NextResponse.json({
          success: true,
          groups: groups.map(group => ({
            id: group.id,
            name: group.name,
            description: group.description,
            category: group.category,
            privacyLevel: group.privacyLevel,
            memberCount: group.memberCount,
            tags: group.tags,
            createdAt: group.createdAt
          }))
        });
      }

      case 'get_posts': {
        const groupId = searchParams.get('groupId');
        const limit = parseInt(searchParams.get('limit') || '20');
        const posts = communityService.getCommunityPosts(groupId || undefined, Math.min(limit, 100));

        return NextResponse.json({
          success: true,
          posts: posts.map(post => ({
            id: post.id,
            authorId: post.authorId,
            groupId: post.groupId,
            title: post.title,
            content: post.content.substring(0, 500), // Truncate for preview
            contentType: post.contentType,
            tags: post.tags,
            mood: post.mood,
            triggerWarnings: post.triggerWarnings,
            likes: post.likes,
            replies: post.replies,
            createdAt: post.createdAt,
            isAnonymous: post.isAnonymous,
            moderationStatus: post.moderationStatus
          }))
        });
      }

      case 'get_comments': {
        const postId = searchParams.get('postId');

        if (!postId) {
          return NextResponse.json(
            { error: 'Post ID is required' },
            { status: 400 }
          );
        }

        const comments = communityService.getPostComments(postId);

        return NextResponse.json({
          success: true,
          comments: comments.map(comment => ({
            id: comment.id,
            authorId: comment.authorId,
            content: comment.content,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            likes: comment.likes,
            isAnonymous: comment.isAnonymous,
            moderationStatus: comment.moderationStatus
          }))
        });
      }

      case 'get_events': {
        const upcomingOnly = searchParams.get('upcomingOnly') !== 'false';
        const events = communityService.getCommunityEvents(upcomingOnly);

        return NextResponse.json({
          success: true,
          events: events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            eventType: event.eventType,
            startTime: event.startTime,
            endTime: event.endTime,
            maxParticipants: event.maxParticipants,
            currentParticipants: event.currentParticipants,
            location: event.location,
            tags: event.tags,
            isPublic: event.isPublic,
            status: event.status,
            createdAt: event.createdAt
          }))
        });
      }

      case 'get_profile': {
        const userId = searchParams.get('userId');

        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        const profile = communityService.getUserProfile(userId);

        if (!profile) {
          return NextResponse.json(
            { error: 'Profile not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          profile: {
            userId: profile.userId,
            displayName: profile.displayName,
            bio: profile.bio,
            interests: profile.interests,
            supportAreas: profile.supportAreas,
            anonymityLevel: profile.anonymityLevel,
            joinedAt: profile.joinedAt,
            lastActive: profile.lastActive,
            isActive: profile.isActive
          }
        });
      }

      case 'get_connections': {
        const userId = searchParams.get('userId');

        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        const connections = communityService.getUserConnections(userId);

        return NextResponse.json({
          success: true,
          connections: connections.map(conn => ({
            id: conn.id,
            connectedUserId: conn.connectedUserId,
            connectionType: conn.connectionType,
            status: conn.status,
            trustLevel: conn.trustLevel,
            lastInteraction: conn.lastInteraction,
            createdAt: conn.createdAt
          }))
        });
      }

      case 'get_support_matches': {
        const userId = searchParams.get('userId');

        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        const matches = peerSupportService.getSupportMatches(userId);

        return NextResponse.json({
          success: true,
          matches: matches.map(match => ({
            matchedUserId: match.matchedUserId,
            matchScore: match.matchScore,
            matchReasons: match.matchReasons,
            recommendedSessionType: match.recommendedSessionType,
            confidence: match.confidence,
            expiresAt: match.expiresAt
          }))
        });
      }

      case 'get_support_network': {
        const userId = searchParams.get('userId');

        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        const network = peerSupportService.getSupportNetwork(userId);

        if (!network) {
          return NextResponse.json(
            { error: 'Support network not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          network: {
            userId: network.userId,
            networkType: network.networkType,
            connectionsCount: network.connections.length,
            networkStrength: network.networkStrength,
            diversityScore: network.diversityScore,
            lastUpdated: network.lastUpdated
          }
        });
      }

      case 'get_stats': {
        const communityStats = communityService.getCommunityStats();
        const peerStats = peerSupportService.getPeerSupportStats();

        return NextResponse.json({
          success: true,
          stats: {
            community: communityStats,
            peerSupport: peerStats
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: get_groups, get_posts, get_comments, get_events, get_profile, get_connections, get_support_matches, get_support_network, get_stats' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to get community data via API');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve community data'
      },
      { status: 500 }
    );
  }
}