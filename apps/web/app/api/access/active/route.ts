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
        .from('access_sessions')
        .select('*, devices (device_name, hostname, status)')
        .in('status', ['ACTIVE', 'EXPIRING', 'AUTHORIZED'])
        .order('created_at', { ascending: false });

      if (userId === DEMO_USER_ID || userId === PRIMARY_OWNER_ID || userId === LEGACY_DEMO_OWNER_ID) {
        query = query.or(`owner_id.eq.${userId},owner_id.eq.${PRIMARY_OWNER_ID},owner_id.eq.${LEGACY_DEMO_OWNER_ID}`);
      } else {
        query = query.eq('owner_id', userId);
      }

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
