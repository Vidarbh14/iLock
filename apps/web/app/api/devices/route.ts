import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      let query = supabase
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
        .order('created_at', { ascending: false });

      const PRIMARY_OWNER_ID = 'a6b3545a-0e0e-4603-b038-af01e996dbec';
      const LEGACY_DEMO_OWNER_ID = 'c60ba6f8-265f-4191-8ab2-9bf1316c43e3';

      // Multi-tenant device isolation:
      // Show devices belonging to this authenticated user or legacy/primary workstation owner
      if (userId === DEMO_USER_ID || userId === PRIMARY_OWNER_ID || userId === LEGACY_DEMO_OWNER_ID) {
        query = query.or(`owner_id.eq.${userId},owner_id.eq.${PRIMARY_OWNER_ID},owner_id.eq.${LEGACY_DEMO_OWNER_ID},owner_id.eq.${DEMO_USER_ID}`);
      } else {
        query = query.eq('owner_id', userId);
      }

      const { data: devices, error } = await query;

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to retrieve devices', 500, error.message);
      }

      const mappedDevices = (devices || []).map((d: any) => ({
        ...d,
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
      }));

      return jsonResponse({ devices: mappedDevices });
    }

    // Demo Mode Store
    const devices = demoStore.getDevices(userId).map((d) => {
      const tel = demoStore.telemetry.get(d.id);
      return {
        ...d,
        device_status: tel ? [tel] : [],
      };
    });

    return jsonResponse({ devices });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
