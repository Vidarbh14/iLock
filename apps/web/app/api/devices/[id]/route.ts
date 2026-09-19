import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const PRIMARY_OWNER_ID = 'a6b3545a-0e0e-4603-b038-af01e996dbec';
      const LEGACY_DEMO_OWNER_ID = 'c60ba6f8-265f-4191-8ab2-9bf1316c43e3';

      let query = supabase
        .from('devices')
        .select(`
          *,
          device_status (*),
          access_sessions (*)
        `)
        .eq('id', deviceId);

      if (userId !== DEMO_USER_ID && userId !== PRIMARY_OWNER_ID && userId !== LEGACY_DEMO_OWNER_ID) {
        query = query.eq('owner_id', userId);
      }

      const { data: device, error } = await query.single();

      if (error || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found or not owned by user', 404);
      }

      const nowMs = Date.now();
      const HEARTBEAT_TIMEOUT_MS = 8000;
      const lastSeenMs = device.last_seen ? new Date(device.last_seen).getTime() : 0;
      const isStale = (nowMs - lastSeenMs) > HEARTBEAT_TIMEOUT_MS;
      const computedStatus = isStale ? 'offline' : (device.status || 'online');

      if (isStale && device.status === 'online') {
        supabase.from('devices').update({ status: 'offline' }).eq('id', device.id).then();
      }

      const rawStatus = Array.isArray(device.device_status) ? device.device_status : (device.device_status ? [device.device_status] : []);
      const patchedStatus = rawStatus.map((st: any) => isStale ? { ...st, workstation_locked: true } : st);

      const mappedDevice = {
        ...device,
        status: computedStatus,
        device_status: patchedStatus,
        deviceName: device.device_name || device.deviceName || 'Windows PC',
        deviceUuid: device.device_uuid || device.deviceUuid,
        ownerId: device.owner_id || device.ownerId,
        osVersion: device.os_version || device.osVersion,
        agentVersion: device.agent_version || device.agentVersion,
        publicKey: device.public_key || device.publicKey,
        publicKeyAlgorithm: device.public_key_algorithm || device.publicKeyAlgorithm,
        lastSeen: device.last_seen || device.lastSeen || new Date().toISOString(),
        isTrusted: device.is_trusted !== undefined ? device.is_trusted : device.isTrusted,
      };

      return jsonResponse({ device: mappedDevice });
    }

    // Demo Mode Store
    const device = demoStore.getDeviceById(deviceId);
    if (!device || device.ownerId !== userId) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const tel = demoStore.telemetry.get(deviceId);
    const sessions = demoStore.getSessions(userId).filter((s) => s.deviceId === deviceId);

    return jsonResponse({
      device: {
        ...device,
        device_status: tel ? [tel] : [],
        access_sessions: sessions,
      },
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      // Verify ownership
      const { data: device } = await supabase
        .from('devices')
        .select('id, device_name')
        .eq('id', deviceId)
        .eq('owner_id', userId)
        .single();

      if (!device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
      }

      // Mark any active sessions as REVOKED
      await supabase
        .from('access_sessions')
        .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
        .eq('device_id', deviceId)
        .in('status', ['ACTIVE', 'AUTHORIZED', 'EXPIRING', 'PENDING']);

      // Remove device credentials
      await supabase.from('device_credentials').delete().eq('device_id', deviceId);

      // Delete device
      await supabase.from('devices').delete().eq('id', deviceId);

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        device_id: deviceId,
        event_type: 'DEVICE_REMOVED',
        success: true,
        reason: `Device '${device.device_name}' removed by owner`,
        details: { deviceId },
      });

      return jsonResponse({ success: true, message: 'Device removed and sessions invalidated' });
    }

    // Demo Mode Store
    const removed = demoStore.removeDevice(deviceId, userId);
    if (!removed) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found or not owned by user', 404);
    }

    return jsonResponse({ success: true, message: 'Device removed and sessions invalidated (Demo sandbox)' });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
