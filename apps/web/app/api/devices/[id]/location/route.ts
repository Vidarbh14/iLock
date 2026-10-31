import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { LOCATION_RETENTION_MS } from '@/lib/location-helper';
import { LocationLiveSchema } from '@ilock/shared';
import type { DeviceLocationFix } from '@ilock/shared';
import crypto from 'node:crypto';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId && isSupabaseConfigured()) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device } = await supabase
        .from('devices')
        .select('id, last_seen, device_status (latitude, longitude, location_accuracy_m, location_source, location_city, location_fixed_at)')
        .eq('id', deviceId)
        .eq('owner_id', userId)
        .single();

      if (!device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found or not owned by user', 404);
      }

      const st: any = Array.isArray(device.device_status) ? device.device_status[0] : device.device_status;
      const latest: DeviceLocationFix | null = st && st.latitude !== null && st.longitude !== null
        ? {
            latitude: st.latitude,
            longitude: st.longitude,
            accuracyM: st.location_accuracy_m,
            source: st.location_source,
            city: st.location_city,
            fixedAt: st.location_fixed_at,
          }
        : null;

      const { data: history } = await supabase
        .from('device_locations')
        .select('latitude, longitude, accuracy_m, source, city, recorded_at')
        .eq('device_id', deviceId)
        .gte('recorded_at', new Date(Date.now() - LOCATION_RETENTION_MS).toISOString())
        .order('recorded_at', { ascending: false })
        .limit(500);

      return jsonResponse({
        success: true,
        latest,
        lastSeen: device.last_seen,
        history: (history || []).map((h) => ({
          latitude: h.latitude,
          longitude: h.longitude,
          accuracyM: h.accuracy_m,
          source: h.source,
          city: h.city,
          fixedAt: h.recorded_at,
        })),
      });
    }

    const tele = demoStore.telemetry.get(deviceId);
    return jsonResponse({
      success: true,
      latest: tele?.location ?? null,
      lastSeen: tele?.lastHeartbeat ?? null,
      history: tele?.location ? [tele.location] : [],
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId && isSupabaseConfigured()) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    const body = await request.json();
    const parseResult = LocationLiveSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid location payload', 400, parseResult.error.format());
    }

    const { enabled, durationSeconds } = parseResult.data;
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    const payload = { action: 'LOCATION_LIVE', enabled, durationSeconds };

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device || (userId && device.owner_id !== userId)) {
        return errorResponse('FORBIDDEN', 'Access denied to this workstation', 403);
      }

      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING',
        nonce,
        payload: { ...payload, requestedBy: userId },
        expires_at: expiresAt,
      });

      // Only live-tracking starts are audited; routine polling of the last location is not
      if (enabled) {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          device_id: deviceId,
          event_type: 'LOCATION_LIVE_REQUESTED',
          success: true,
          reason: `Live location tracking requested for ${durationSeconds}s`,
          details: { durationSeconds },
        });
      }

      return jsonResponse({
        success: true,
        message: enabled ? 'Live location tracking requested' : 'Live location tracking stopped',
      });
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload,
      signature: null,
      isDispatched: false,
      dispatchedAt: null,
      isAcknowledged: false,
      acknowledgedAt: null,
      resultStatus: null,
      resultError: null,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    return jsonResponse({
      success: true,
      message: `Live location ${enabled ? 'requested' : 'stopped'} (Demo mode)`,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
