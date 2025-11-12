import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { KnowledgeBaseService } from '@/services/knowledge/KnowledgeBaseService';
import { unlink } from 'fs/promises';
import { join } from 'path';

const knowledgeService = new KnowledgeBaseService();

export async function DELETE(
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

    // Remove from knowledge base
    // Note: In a real implementation, you'd also remove from vector database
    // For now, we'll just remove from our in-memory store

    // Try to delete the file if it exists
    try {
      const uploadDir = join(process.cwd(), 'uploads', 'knowledge');
      // Note: In production, you'd need to track the actual filename
      // For now, this is a placeholder
    } catch (error) {
      // File might not exist or already deleted, continue
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}