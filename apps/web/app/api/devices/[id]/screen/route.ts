import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import crypto from 'node:crypto';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: latest } = await supabase
        .from('authorization_requests')
        .select('result_error, acknowledged_at, result_status')
        .eq('device_id', deviceId)
        .eq('is_acknowledged', true)
        .in('result_status', ['SCREENSHOT_CAPTURED', 'SUCCESS'])
        .order('acknowledged_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest && latest.result_error && latest.result_error.startsWith('data:image/')) {
        return jsonResponse({
          captured: true,
          screenshot: latest.result_error,
          capturedAt: latest.acknowledged_at,
        });
      }
    }

    const capture = demoStore.getScreenCapture(deviceId);

    return jsonResponse({
      captured: Boolean(capture),
      screenshot: capture?.imageBase64 || null,
      capturedAt: capture?.capturedAt || null,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device || device.owner_id !== userId) {
        return errorResponse('FORBIDDEN', 'Access denied to this device', 403);
      }

      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING',
        nonce,
        payload: { action: 'screenshot', requestedBy: userId },
        expires_at: expiresAt,
      });

      return jsonResponse({ success: true, message: 'Screenshot command enqueued' });
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: { action: 'screenshot', requestedBy: userId },
      signature: null,
      isDispatched: false,
      dispatchedAt: null,
      isAcknowledged: false,
      acknowledgedAt: null,
      resultStatus: null,
      resultError: null,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    return jsonResponse({ success: true, message: 'Screenshot command enqueued (Demo mode)' });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
