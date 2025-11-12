import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiKeyService, ApiKeyData } from '@/lib/api-key-service';
import { logInfo, logError } from '@/lib/logger';

// GET /api/keys - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeys = await apiKeyService.getUserApiKeys((session.user as any).id);

    logInfo('API keys retrieved', {
      userId: session.user.id,
      count: apiKeys.length,
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    logError('Failed to get API keys', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ApiKeyData = await request.json();

    // Validate required fields
    if (!body.name || !body.provider || !body.apiKey) {
      return NextResponse.json(
        { error: 'Name, provider, and API key are required' },
        { status: 400 }
      );
    }

    const apiKey = await apiKeyService.createApiKey((session.user as any).id, body);

    logInfo('API key created via API', {
      userId: (session.user as any).id,
      keyId: apiKey.id,
      provider: body.provider,
    });

    return NextResponse.json({ apiKey }, { status: 201 });
  } catch (error: any) {
    logError('Failed to create API key', error);

    if (error.message.includes('already exists') || error.message.includes('Invalid API key')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}