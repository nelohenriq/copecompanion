import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { KnowledgeBaseService } from '@/services/knowledge/KnowledgeBaseService';

const knowledgeService = new KnowledgeBaseService();

export async function GET(request: NextRequest) {
  try {
    // Get user session and check admin role
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documents = knowledgeService.getAllDocuments();

    return NextResponse.json({
      success: true,
      documents
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch documents',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}