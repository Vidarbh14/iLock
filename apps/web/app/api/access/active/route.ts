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
        .from('access_sessions')
        .select('*, devices (device_name, hostname, status)')
        .eq('owner_id', userId)
        .in('status', ['ACTIVE', 'EXPIRING', 'AUTHORIZED'])
        .order('created_at', { ascending: false });

      const { data: sessions, error } = await query;

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to retrieve active sessions', 500, error.message);
      }

      const mappedSessions = (sessions || []).map((s: any) => ({
        ...s,
        id: s.id,
        deviceId: s.device_id || s.deviceId,
        device_id: s.device_id || s.deviceId,
        ownerId: s.owner_id || s.ownerId,
        owner_id: s.owner_id || s.ownerId,
        sessionType: s.session_type || s.sessionType || 'temporary_access',
        session_type: s.session_type || s.sessionType || 'temporary_access',
        status: s.status,
        durationMinutes: Number(s.duration_minutes ?? s.durationMinutes ?? 15),
        duration_minutes: Number(s.duration_minutes ?? s.durationMinutes ?? 15),
        expiresAt: s.expires_at || s.expiresAt,
        expires_at: s.expires_at || s.expiresAt,
        createdAt: s.created_at || s.createdAt || new Date().toISOString(),
        created_at: s.created_at || s.createdAt || new Date().toISOString(),
        authorizedAt: s.authorized_at || s.authorizedAt,
        authorized_at: s.authorized_at || s.authorizedAt,
        activatedAt: s.activated_at || s.activatedAt,
        activated_at: s.activated_at || s.activatedAt,
        revokedAt: s.revoked_at || s.revokedAt,
        revoked_at: s.revoked_at || s.revokedAt,
        metadata: typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata || {}),
        devices: s.devices || null,
      }));

      return jsonResponse({ activeSessions: mappedSessions });
    }

    return jsonResponse({ activeSessions: [] });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
