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
      const PRIMARY_OWNER_ID = 'a6b3545a-0e0e-4603-b038-af01e996dbec';
      const LEGACY_DEMO_OWNER_ID = 'c60ba6f8-265f-4191-8ab2-9bf1316c43e3';

      let query = supabase
        .from('audit_logs')
        .select('*, devices (device_name)')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (userId === DEMO_USER_ID || userId === PRIMARY_OWNER_ID || userId === LEGACY_DEMO_OWNER_ID) {
        query = query.or(`user_id.eq.${userId},user_id.eq.${PRIMARY_OWNER_ID},user_id.eq.${LEGACY_DEMO_OWNER_ID}`);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data: logs, error } = await query;

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to retrieve audit logs', 500, error.message);
      }

      const mappedLogs = (logs || []).map((l: any) => ({
        ...l,
        id: l.id,
        userId: l.user_id || l.userId,
        user_id: l.user_id || l.userId,
        deviceId: l.device_id || l.deviceId,
        device_id: l.device_id || l.deviceId,
        eventType: l.event_type || l.eventType || 'UNKNOWN',
        event_type: l.event_type || l.eventType || 'UNKNOWN',
        timestamp: l.timestamp || l.created_at || new Date().toISOString(),
        created_at: l.timestamp || l.created_at || new Date().toISOString(),
        ipHash: l.ip_hash || l.ipHash || null,
        ip_hash: l.ip_hash || l.ipHash || null,
        userAgent: l.user_agent || l.userAgent || null,
        user_agent: l.user_agent || l.userAgent || null,
        success: Boolean(l.success),
        reason: l.reason || 'Security event logged',
        details: l.details || {},
        devices: l.devices || null,
      }));

      return jsonResponse({ logs: mappedLogs });
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
