import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';
import crypto from 'node:crypto';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId && isSupabaseConfigured()) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const effectiveUserId = userId || DEMO_USER_ID;

    const { id: deviceId } = params;
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    demoStore.pingStream(deviceId);

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device } = await supabase
        .from('devices')
        .select('id, owner_id')
        .eq('id', deviceId)
        .single();

      if (!device || device.owner_id !== effectiveUserId) {
        return errorResponse('FORBIDDEN', 'Access denied', 403);
      }

      // Enqueue keep-alive ping for agent watchdog
      const nonce = crypto.randomUUID();
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING',
        nonce,
        payload: {
          action: 'STREAM_PING',
          pingTime: new Date().toISOString(),
        },
        expires_at: new Date(Date.now() + 30 * 1000).toISOString(),
      });

      return jsonResponse({
        success: true,
        message: 'Stream keep-alive ping acknowledged',
        serverTime: new Date().toISOString(),
      });
    }

    return jsonResponse({
      success: true,
      message: 'Stream keep-alive ping acknowledged (Demo mode)',
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
