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

    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device || device.owner_id !== effectiveUserId) {
        return errorResponse('FORBIDDEN', 'Access denied to this workstation', 403);
      }

      // Enqueue stream stop command
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING',
        nonce,
        payload: {
          action: 'STOP_SCREEN_STREAM',
          requestedBy: effectiveUserId,
          stoppedAt: new Date().toISOString(),
        },
        expires_at: expiresAt,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: effectiveUserId,
        device_id: deviceId,
        event_type: 'SCREEN_STREAM_STOPPED',
        success: true,
        reason: 'Live screen sharing stopped by owner',
        details: { deviceId },
      });

      demoStore.stopStream(deviceId);

      return jsonResponse({
        success: true,
        message: 'Screen streaming stopped. Workstation capture idle to preserve battery.',
      });
    }

    // Demo store
    demoStore.stopStream(deviceId);
    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: {
        action: 'STOP_SCREEN_STREAM',
        requestedBy: effectiveUserId,
      },
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

    demoStore.addAuditLog({
      userId: effectiveUserId,
      deviceId,
      eventType: 'SCREEN_STREAM_STOPPED',
      success: true,
      reason: 'Live screen sharing stopped (Demo mode)',
      details: {},
    });

    return jsonResponse({
      success: true,
      message: 'Screen streaming stopped (Demo mode)',
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
