import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { KnowledgeBaseService } from '@/services/knowledge/KnowledgeBaseService';

const knowledgeService = new KnowledgeBaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    // Get user session and check admin role
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await params;
    const document = knowledgeService.getDocumentStatus(documentId);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      documentId,
      status: document.status,
      chunkCount: document.chunkCount
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get document status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}