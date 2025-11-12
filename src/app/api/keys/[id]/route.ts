import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiKeyService } from '@/lib/api-key-service';
import { logInfo, logError } from '@/lib/logger';

// GET /api/keys/[id] - Get specific API key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = await apiKeyService.getApiKey((session.user as any).id, id);

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ apiKey });
  } catch (error) {
    logError('Failed to get API key', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/keys/[id] - Update API key
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();

    const apiKey = await apiKeyService.updateApiKey((session.user as any).id, id, updates);

    logInfo('API key updated via API', {
      userId: (session.user as any).id,
      keyId: id,
      updates: Object.keys(updates),
    });

    return NextResponse.json({ apiKey });
  } catch (error: any) {
    logError('Failed to update API key', error);

    if (error.message.includes('Invalid API key')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/keys/[id] - Delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await apiKeyService.deleteApiKey((session.user as any).id, id);

    logInfo('API key deleted via API', {
      userId: (session.user as any).id,
      keyId: id,
    });

    return NextResponse.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logError('Failed to delete API key', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}