import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// Basic validation functions (replace with zod in production)
function validateCreateContent(data: any) {
  const errors: string[] = [];

  if (!data.title || typeof data.title !== 'string' || data.title.length < 1 || data.title.length > 200) {
    errors.push('Title must be a string between 1 and 200 characters');
  }

  if (!data.slug || typeof data.slug !== 'string' || !/^[a-z0-9-]+$/.test(data.slug)) {
    errors.push('Slug must be a valid URL-friendly string');
  }

  const validContentTypes = ['article', 'exercise', 'video', 'audio', 'assessment', 'resource'];
  if (!data.contentType || !validContentTypes.includes(data.contentType)) {
    errors.push('Content type must be one of: ' + validContentTypes.join(', '));
  }

  if (errors.length > 0) {
    throw new Error('Validation failed: ' + errors.join('; '));
  }

  return data;
}

// Helper function to check permissions
async function checkContentPermissions(userId: string, action: 'create' | 'read' | 'update' | 'delete' | 'publish', content?: any) {
  // Get user role (simplified - in production, this would check user roles/permissions)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }, // In production, check roles/permissions
  });

  if (!user) return false;

  // Basic permission checks (expand based on your role system)
  switch (action) {
    case 'create':
    case 'read':
      return true; // Allow authenticated users to create/read
    case 'update':
    case 'delete':
      return content?.createdBy === userId; // Only creator can edit/delete
    case 'publish':
      return content?.createdBy === userId; // Only creator can publish (in production, check roles)
    default:
      return false;
  }
}

// GET /api/content - List content with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status') || 'published';
    const contentType = searchParams.get('contentType');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const author = searchParams.get('author');

    // Build where clause
    const where: any = {};

    // Status filter
    if (status !== 'all') {
      where.status = status;
    }

    // Content type filter
    if (contentType) {
      where.contentType = contentType;
    }

    // Category filter
    if (category) {
      where.category = {
        has: category,
      };
    }

    // Author filter
    if (author) {
      where.createdBy = author;
    }

    // Search filter (basic text search)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    // Access control - filter based on user permissions
    if (!user) {
      // Anonymous users can only see public content
      where.accessLevel = 'public';
      where.requiresAuth = false;
    } else {
      // Authenticated users can see public + authenticated content
      where.OR = where.OR || [];
      where.OR.push(
        { accessLevel: 'public' },
        { accessLevel: 'authenticated' }
      );
      // TODO: Add professional content access based on user roles
    }

    const [content, total] = await Promise.all([
      (prisma as any).content.findMany({
        where,
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (prisma as any).content.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        content,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to fetch content');

    return NextResponse.json({
      error: 'Failed to fetch content',
    }, { status: 500 });
  }
}

// POST /api/content - Create new content
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check create permissions
    if (!(await checkContentPermissions(user.id, 'create'))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = validateCreateContent(body);

    // Create content
    const content = await (prisma as any).content.create({
      data: {
        ...validatedData,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log content creation
    await (prisma as any).contentAccess.create({
      data: {
        contentId: content.id,
        userId: user.id,
        action: 'create',
      },
    });

    logger.info({
      contentId: content.id,
      userId: user.id,
      contentType: content.contentType,
    }, 'Content created');

    return NextResponse.json({
      success: true,
      data: content,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.message,
      }, { status: 400 });
    }

    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to create content');

    return NextResponse.json({
      error: 'Failed to create content',
    }, { status: 500 });
  }
}