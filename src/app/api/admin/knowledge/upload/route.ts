import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { KnowledgeBaseService } from '@/services/knowledge/KnowledgeBaseService';

// Ensure upload directory exists
const ensureUploadDir = async (dirPath: string) => {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
};

export async function POST(request: NextRequest) {
  try {
    // Get user session and check admin role
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin role check
    // if (!user.roles?.includes('admin')) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    // }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const categories = JSON.parse(formData.get('categories') as string);
    const contentType = formData.get('contentType') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/html'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.md')) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Generate unique document ID
    const documentId = crypto.randomUUID();

    // Create upload directory
    const uploadDir = join(process.cwd(), 'uploads', 'knowledge');
    await ensureUploadDir(uploadDir);

    // Save file to disk
    const filePath = join(uploadDir, `${documentId}-${file.name}`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    logger.info({
      userId: user.id,
      documentId,
      filename: file.name,
      fileSize: file.size,
      contentType,
      categories
    }, 'Knowledge document uploaded');

    // Initialize knowledge base service
    const knowledgeService = new KnowledgeBaseService();

    // Start document processing (async)
    processDocument(knowledgeService, documentId, filePath, {
      filename: file.name,
      contentType,
      categories,
      uploadedBy: user.id,
      fileSize: file.size
    }).catch(error => {
      logger.error({
        documentId,
        error: error.message
      }, 'Document processing failed');
    });

    return NextResponse.json({
      success: true,
      documentId,
      message: 'Document uploaded successfully. Processing started.'
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Knowledge document upload failed');

    return NextResponse.json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Async document processing function
async function processDocument(
  knowledgeService: KnowledgeBaseService,
  documentId: string,
  filePath: string,
  metadata: any
) {
  try {
    // Update document status to processing
    await knowledgeService.updateDocumentStatus(documentId, 'processing');

    // Extract text from document
    const extractedText = await knowledgeService.extractText(filePath, metadata.contentType);

    // Chunk the text
    const chunks = await knowledgeService.chunkText(extractedText, {
      chunkSize: 1000,
      chunkOverlap: 200
    });

    // Generate embeddings for chunks
    const embeddings = await knowledgeService.generateEmbeddings(chunks);

    // Store chunks and embeddings in vector database
    await knowledgeService.storeChunks(documentId, chunks, embeddings, metadata);

    // Update document status to ready
    await knowledgeService.updateDocumentStatus(documentId, 'ready', {
      chunkCount: chunks.length
    });

    logger.info({
      documentId,
      chunkCount: chunks.length
    }, 'Document processing completed');

  } catch (error) {
    // Update document status to error
    await knowledgeService.updateDocumentStatus(documentId, 'error');

    logger.error({
      documentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Document processing failed');
  }
}