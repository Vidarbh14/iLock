import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';
import { StartScreenStreamSchema } from '@ilock/shared';
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

    const parseResult = StartScreenStreamSchema.safeParse(body);
    const { quality = 'balanced', targetFps = 4 } = parseResult.success ? parseResult.data : { quality: 'balanced' as const, targetFps: 4 };

    const streamSessionId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, device_name, owner_id, status')
        .eq('id', deviceId)
        .single();

      if (devErr || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
      }

      if (device.owner_id !== effectiveUserId) {
        return errorResponse('FORBIDDEN', 'Access denied to this workstation', 403);
      }

      if (device.status !== 'online') {
        return errorResponse('DEVICE_OFFLINE', `'${device.device_name}' is currently offline. Stream cannot start.`, 409);
      }

      // Enqueue stream start command with balanced 540p / 4 FPS settings
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING',
        nonce,
        payload: {
          action: 'START_SCREEN_STREAM',
          streamSessionId,
          quality,
          targetFps,
          requestedBy: effectiveUserId,
          initiatedAt: new Date().toISOString(),
        },
        expires_at: expiresAt,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: effectiveUserId,
        device_id: deviceId,
        event_type: 'SCREEN_STREAM_STARTED',
        success: true,
        reason: 'Live screen sharing started by owner',
        details: { deviceId, quality, targetFps, streamSessionId },
      });

      // Save in memory tracker
      demoStore.startStream(deviceId, quality, targetFps, streamSessionId);

      return jsonResponse({
        success: true,
        streamSessionId,
        quality,
        targetFps,
        message: 'Live screen streaming command dispatched to workstation',
      });
    }

    // Demo store mode
    const device = demoStore.getDeviceById(deviceId);
    if (!device) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found in demo store', 404);
    }

    demoStore.startStream(deviceId, quality, targetFps, streamSessionId);
    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: {
        action: 'START_SCREEN_STREAM',
        streamSessionId,
        quality,
        targetFps,
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
      eventType: 'SCREEN_STREAM_STARTED',
      success: true,
      reason: 'Live screen streaming started (Demo mode)',
      details: { quality, targetFps, streamSessionId },
    });

    return jsonResponse({
      success: true,
      streamSessionId,
      quality,
      targetFps,
      message: 'Live screen streaming initiated (Demo mode)',
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
