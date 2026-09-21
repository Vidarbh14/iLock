import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      // Strict Multi-tenant device isolation:
      // Show ONLY devices belonging strictly to this authenticated user
      const query = supabase
        .from('devices')
        .select(`
          *,
          device_status (
            ip_hash,
            cpu_usage_pct,
            memory_usage_pct,
            battery_pct,
            is_charging,
            active_user,
            workstation_locked,
            last_heartbeat
          )
        `)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      const { data: devices, error } = await query;

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to retrieve devices', 500, error.message);
      }

      const nowMs = Date.now();
      const HEARTBEAT_TIMEOUT_MS = 8000; // Agent polls every 400ms - 1000ms. >8s without heartbeat indicates laptop closed / asleep / offline

      const mappedDevices = (devices || []).map((d: any) => {
        const lastSeenMs = d.last_seen ? new Date(d.last_seen).getTime() : 0;
        const isStale = (nowMs - lastSeenMs) > HEARTBEAT_TIMEOUT_MS;
        const computedStatus = isStale ? 'offline' : (d.status || 'online');

        // If stale and DB still thinks it's online, patch DB asynchronously
        if (isStale && d.status === 'online') {
          supabase.from('devices').update({ status: 'offline' }).eq('id', d.id).then();
        }

        // When machine is offline/asleep, ensure device_status reports workstation_locked = true (never in-use)
        const rawStatus = Array.isArray(d.device_status) ? d.device_status : (d.device_status ? [d.device_status] : []);
        const patchedStatus = rawStatus.map((st: any) => isStale ? { ...st, workstation_locked: true } : st);

        return {
          ...d,
          status: computedStatus,
          device_status: patchedStatus,
          deviceName: d.device_name || d.deviceName || 'Windows PC',
          deviceUuid: d.device_uuid || d.deviceUuid,
          ownerId: d.owner_id || d.ownerId,
          osVersion: d.os_version || d.osVersion,
          agentVersion: d.agent_version || d.agentVersion,
          publicKey: d.public_key || d.publicKey,
          publicKeyAlgorithm: d.public_key_algorithm || d.publicKeyAlgorithm,
          lastSeen: d.last_seen || d.lastSeen || new Date().toISOString(),
          isTrusted: d.is_trusted !== undefined ? d.is_trusted : d.isTrusted,
          createdAt: d.created_at || d.createdAt,
          updatedAt: d.updated_at || d.updatedAt,
        };
      });

      return jsonResponse({ devices: mappedDevices });
    }

    return jsonResponse({ devices: [] });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
