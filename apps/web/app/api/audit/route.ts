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
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*, devices (device_name)')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to retrieve audit logs', 500, error.message);
      }

      return jsonResponse({ logs: logs || [] });
    }

    // Demo Mode Store
    const logs = demoStore.auditLogs
      .filter((l) => l.userId === userId)
      .map((l) => {
        const dev = l.deviceId ? demoStore.getDeviceById(l.deviceId) : null;
        return {
          ...l,
          devices: dev ? { device_name: dev.deviceName } : null,
        };
      });

    return jsonResponse({ logs });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
