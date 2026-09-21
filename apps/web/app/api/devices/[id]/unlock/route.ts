import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
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
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty on simple POST
    }

    const biometricVerified = Boolean(body?.biometricVerified);
    const nonce = crypto.randomUUID();
    // 120s expiration allows generous window for cold boot / Wi-Fi reconnection buffer
    const expiresAt = new Date(Date.now() + 120 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      // Check device exists
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, device_name, status, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
      }

      // Multi-tenant permission check: STRICTLY only the real device owner can unlock this computer!
      if (device.owner_id !== userId) {
        return errorResponse('FORBIDDEN', 'You do not have permission to unlock this computer', 403);
      }

      // Enqueue UNLOCK command via CREATE_ACCESS_SESSION for Postgres enum compatibility
      const { error: insertError } = await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'CREATE_ACCESS_SESSION',
        nonce,
        payload: {
          action: 'UNLOCK',
          isUnlock: true,
          requestedBy: userId,
          biometricVerified,
          clientTimestamp: new Date().toISOString(),
        },
        expires_at: expiresAt,
      });

      if (insertError) {
        console.error('Failed to enqueue unlock command:', insertError);
        return errorResponse('COMMAND_DISPATCH_FAILED', insertError.message, 500);
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        device_id: deviceId,
        event_type: 'UNLOCK_REQUEST',
        success: true,
        reason: biometricVerified
          ? 'Workstation unlock authorized via phone biometrics'
          : 'Workstation unlock requested by remote owner',
        details: { deviceId, biometricVerified },
      });

      return jsonResponse({
        success: true,
        message: 'Workstation unlock command dispatched via phone authentication',
        biometricVerified,
      });
    }

    return errorResponse('NOT_SUPPORTED', 'Service unavailable', 503);
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
