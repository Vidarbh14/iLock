import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();
      const { data: devices, error } = await supabase
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

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to retrieve devices', 500, error.message);
      }

      return jsonResponse({ devices: devices || [] });
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
