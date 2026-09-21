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

      const query = supabase
        .from('audit_logs')
        .select('*, devices (device_name)')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100);

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

    return jsonResponse({ logs: [] });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
