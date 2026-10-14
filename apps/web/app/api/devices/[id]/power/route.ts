import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { PowerCommandSchema } from '@ilock/shared';
import crypto from 'node:crypto';

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
    const body = await request.json();
    const parseResult = PowerCommandSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid power command parameters', 400, parseResult.error.format());
    }

    const { action } = parseResult.data;
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, device_name, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
      }

      if (device.owner_id !== userId) {
        return errorResponse('FORBIDDEN', 'You do not have permission to manage power for this device', 403);
      }

      // Enqueue power command
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING', // using DEVICE_PING with payload action for Postgres enum compatibility
        nonce,
        payload: { action, requestedBy: userId, initiatedAt: new Date().toISOString() },
        expires_at: expiresAt,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        device_id: deviceId,
        event_type: `POWER_${action.toUpperCase()}`,
        success: true,
        reason: `Remote power action '${action}' requested by owner`,
        details: { deviceId, action },
      });

      return jsonResponse({
        success: true,
        message: `Power command '${action}' dispatched to workstation`,
      });
    }

    // Demo store fallback
    const device = demoStore.getDeviceById(deviceId);
    if (!device) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found in demo store', 404);
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: { action, requestedBy: userId },
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
      userId,
      deviceId,
      eventType: `POWER_${action.toUpperCase()}`,
      success: true,
      reason: `Remote power action '${action}' dispatched`,
      details: { action },
    });

    return jsonResponse({
      success: true,
      message: `Power command '${action}' dispatched to workstation (Demo mode)`,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
