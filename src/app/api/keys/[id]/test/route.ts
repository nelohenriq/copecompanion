import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiKeyService } from '@/lib/api-key-service';
import { logInfo, logError } from '@/lib/logger';

// POST /api/keys/[id]/test - Test API key validity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await apiKeyService.testApiKey((session.user as any).id, id);

    logInfo('API key tested', {
      userId: (session.user as any).id,
      keyId: id,
      valid: result.valid,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError('Failed to test API key', error);
    return NextResponse.json(
      { error: 'Internal server error', valid: false },
      { status: 500 }
    );
  }
}