import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// Default quality checklists for different content types
const DEFAULT_CHECKLISTS = {
  article: [
    { id: 'accuracy', name: 'Factual Accuracy', description: 'Information is accurate and up-to-date', required: true },
    { id: 'sources', name: 'Source Citations', description: 'Key claims supported by credible sources', required: true },
    { id: 'objectivity', name: 'Balanced Perspective', description: 'Presents balanced view without bias', required: true },
    { id: 'readability', name: 'Clear Language', description: 'Written in clear, accessible language', required: true },
    { id: 'structure', name: 'Logical Structure', description: 'Well-organized with clear introduction and conclusion', required: false },
    { id: 'length', name: 'Appropriate Length', description: 'Content length appropriate for topic and audience', required: false },
  ],
  exercise: [
    { id: 'safety', name: 'Safety Instructions', description: 'Clear safety guidelines and contraindications', required: true },
    { id: 'instructions', name: 'Clear Instructions', description: 'Step-by-step instructions are easy to follow', required: true },
    { id: 'progression', name: 'Progressive Difficulty', description: 'Exercises build progressively in difficulty', required: false },
    { id: 'modifications', name: 'Modifications Provided', description: 'Alternative versions for different ability levels', required: false },
    { id: 'duration', name: 'Time Estimates', description: 'Realistic time estimates for completion', required: true },
    { id: 'benefits', name: 'Benefits Explained', description: 'Clear explanation of expected benefits', required: true },
  ],
  video: [
    { id: 'quality', name: 'Video Quality', description: 'Clear audio and video, professional presentation', required: true },
    { id: 'accuracy', name: 'Content Accuracy', description: 'Information presented is accurate and evidence-based', required: true },
    { id: 'engagement', name: 'Engaging Delivery', description: 'Presenter is engaging and maintains audience attention', required: false },
    { id: 'accessibility', name: 'Accessibility Features', description: 'Captions, transcripts, or sign language available', required: true },
    { id: 'length', name: 'Appropriate Length', description: 'Video length appropriate for content and attention spans', required: false },
    { id: 'structure', name: 'Clear Structure', description: 'Well-organized with clear beginning, middle, and end', required: true },
  ],
  audio: [
    { id: 'quality', name: 'Audio Quality', description: 'Clear audio, no background noise or distractions', required: true },
    { id: 'content', name: 'Content Value', description: 'Provides meaningful and useful information', required: true },
    { id: 'pacing', name: 'Appropriate Pacing', description: 'Speaking pace allows for comprehension and reflection', required: true },
    { id: 'structure', name: 'Clear Structure', description: 'Well-organized with introduction and conclusion', required: false },
    { id: 'transcription', name: 'Transcription Available', description: 'Written transcript available for accessibility', required: true },
    { id: 'length', name: 'Appropriate Length', description: 'Length appropriate for content and format', required: false },
  ],
  assessment: [
    { id: 'validity', name: 'Assessment Validity', description: 'Questions measure what they intend to measure', required: true },
    { id: 'reliability', name: 'Assessment Reliability', description: 'Consistent results over time and conditions', required: true },
    { id: 'clarity', name: 'Clear Instructions', description: 'Instructions are clear and unambiguous', required: true },
    { id: 'scoring', name: 'Clear Scoring', description: 'Scoring system is clear and interpretable', required: true },
    { id: 'privacy', name: 'Privacy Protection', description: 'Assessment protects user privacy and confidentiality', required: true },
    { id: 'cultural', name: 'Cultural Sensitivity', description: 'Appropriate for diverse cultural backgrounds', required: false },
  ],
  resource: [
    { id: 'relevance', name: 'Relevance', description: 'Resource is relevant to mental health and wellness', required: true },
    { id: 'credibility', name: 'Source Credibility', description: 'Source is credible and trustworthy', required: true },
    { id: 'currency', name: 'Current Information', description: 'Information is current and up-to-date', required: true },
    { id: 'accessibility', name: 'Easy Access', description: 'Resource is easy to access and use', required: true },
    { id: 'comprehensiveness', name: 'Comprehensive Coverage', description: 'Covers topic adequately and completely', required: false },
    { id: 'usability', name: 'User-Friendly', description: 'Interface and navigation are intuitive', required: false },
  ],
};

// GET /api/content/quality-checklist - Get quality checklist for content type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType');
    const checklistId = searchParams.get('checklistId');

    if (checklistId) {
      // Get specific checklist from database
      const checklist = await (prisma as any).contentQualityChecklist.findUnique({
        where: { id: checklistId },
      });

      if (!checklist) {
        return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: checklist,
      });
    }

    if (contentType) {
      // Get checklist for content type
      const checklist = DEFAULT_CHECKLISTS[contentType as keyof typeof DEFAULT_CHECKLISTS];
      if (!checklist) {
        return NextResponse.json({ error: 'No checklist available for this content type' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          contentType,
          items: checklist,
        },
      });
    }

    // Get all available checklists
    const checklists = await (prisma as any).contentQualityChecklist.findMany({
      where: { isActive: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        default: DEFAULT_CHECKLISTS,
        custom: checklists,
      },
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to fetch quality checklist');

    return NextResponse.json({
      error: 'Failed to fetch quality checklist',
    }, { status: 500 });
  }
}

// POST /api/content/quality-checklist - Create or update quality checklist
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Check if user has permission to create checklists
    // For now, allow any authenticated user

    const body = await request.json();
    const { name, description, items, contentTypes, requiredFor } = body;

    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Name and items array are required' }, { status: 400 });
    }

    const checklist = await (prisma as any).contentQualityChecklist.create({
      data: {
        name,
        description,
        items,
        contentTypes: contentTypes || [],
        requiredFor: requiredFor || [],
        createdBy: user.id,
      },
    });

    logger.info({
      checklistId: checklist.id,
      name: checklist.name,
      userId: user.id,
    }, 'Quality checklist created');

    return NextResponse.json({
      success: true,
      data: checklist,
    }, { status: 201 });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Failed to create quality checklist');

    return NextResponse.json({
      error: 'Failed to create quality checklist',
    }, { status: 500 });
  }
}