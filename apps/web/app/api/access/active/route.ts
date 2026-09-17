import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (isSupabaseConfigured()) {
      const supabase = createServerClient();
      const { data: sessions, error } = await supabase
        .from('access_sessions')
        .select('*, devices (device_name, hostname, status)')
        .eq('owner_id', userId)
        .in('status', ['ACTIVE', 'EXPIRING', 'AUTHORIZED'])
        .order('created_at', { ascending: false });

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to retrieve active sessions', 500, error.message);
      }

      return jsonResponse({ activeSessions: sessions || [] });
    }

    // Demo Mode Store
    const activeSessions = demoStore
      .getSessions(userId)
      .filter((s) => s.status === 'ACTIVE' || s.status === 'EXPIRING' || s.status === 'AUTHORIZED')
      .map((s) => {
        const dev = demoStore.getDeviceById(s.deviceId);
        return {
          ...s,
          devices: dev
            ? { device_name: dev.deviceName, hostname: dev.hostname, status: dev.status }
            : null,
        };
      });

    return jsonResponse({ activeSessions });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
