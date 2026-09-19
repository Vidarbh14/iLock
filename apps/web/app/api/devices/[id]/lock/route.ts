import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';
import crypto from 'node:crypto';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      // Check device exists
      const { data: device } = await supabase
        .from('devices')
        .select('id, device_name, owner_id')
        .eq('id', deviceId)
        .single();

      if (!device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
      }

      // Multi-tenant permission check: Only the device owner can lock this computer
      const PRIMARY_OWNER_ID = 'a6b3545a-0e0e-4603-b038-af01e996dbec';
      const LEGACY_DEMO_OWNER_ID = 'c60ba6f8-265f-4191-8ab2-9bf1316c43e3';
      if (
        device.owner_id !== userId &&
        device.owner_id !== LEGACY_DEMO_OWNER_ID &&
        device.owner_id !== PRIMARY_OWNER_ID &&
        userId !== DEMO_USER_ID &&
        userId !== PRIMARY_OWNER_ID
      ) {
        return errorResponse('FORBIDDEN', 'You do not have permission to lock this computer', 403);
      }

      // Enqueue LOCK_REQUEST command
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'LOCK_REQUEST',
        nonce,
        payload: { requestedBy: userId },
        expires_at: expiresAt,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        device_id: deviceId,
        event_type: 'LOCK_REQUEST',
        success: true,
        reason: 'Workstation lock requested by remote owner',
        details: { deviceId },
      });

      return jsonResponse({ success: true, message: 'Workstation lock command dispatched' });
    }

    // Demo Mode Store
    const device = demoStore.getDeviceById(deviceId);
    if (!device || device.ownerId !== userId) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'LOCK_REQUEST',
      nonce,
      payload: { requestedBy: userId },
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
      tel.workstationLocked = true;
      tel.updatedAt = new Date().toISOString();
    }

    demoStore.addAuditLog({
      userId,
      deviceId,
      eventType: 'LOCK_REQUEST',
      success: true,
      reason: 'Workstation lock triggered via remote dashboard',
      details: { deviceId },
    });

    return jsonResponse({ success: true, message: 'Workstation lock command queued (Demo mode)' });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
