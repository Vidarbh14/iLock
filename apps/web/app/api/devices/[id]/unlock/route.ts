import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import crypto from 'node:crypto';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
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
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      // Check device exists
      const { data: device } = await supabase
        .from('devices')
        .select('id, device_name, status')
        .eq('id', deviceId)
        .single();

      if (!device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
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

    // Demo Mode Store
    const device = demoStore.getDeviceById(deviceId);
    if (!device) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'UNLOCK_REQUEST',
      nonce,
      payload: { requestedBy: userId, biometricVerified },
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

    // Update telemetry state
    const tel = demoStore.telemetry.get(deviceId);
    if (tel) {
      tel.workstationLocked = false;
      tel.updatedAt = new Date().toISOString();
    }

    demoStore.addAuditLog({
      userId,
      deviceId,
      eventType: 'UNLOCK_REQUEST',
      success: true,
      reason: 'Workstation unlock triggered via phone authentication',
      details: { deviceId, biometricVerified },
    });

    return jsonResponse({
      success: true,
      message: 'Workstation unlock command queued',
      biometricVerified,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
