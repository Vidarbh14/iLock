import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { GuestRequestCreateSchema } from '@ilock/shared';
import crypto from 'node:crypto';

// GET /api/access/requests: lists pending guest requests
export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || undefined;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      let query = supabase
        .from('access_sessions')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data: dbSessions } = await query;
      if (Array.isArray(dbSessions)) {
        const requests = dbSessions
          .filter((s: any) => s.metadata && s.metadata.isGuestRequest)
          .map((s: any) => ({
            id: s.id,
            deviceId: s.device_id,
            guestName: s.metadata.guestName || 'Guest User',
            requestedMinutes: s.duration_minutes || 30,
            reason: s.metadata.reason || null,
            status: s.status,
            createdAt: s.created_at,
          }));

        return jsonResponse({ requests });
      }
      return jsonResponse({ requests: [] });
    }

    // Demo store fallback (only when Supabase is not configured)
    const requests = demoStore.getGuestRequests(deviceId);
    return jsonResponse({ requests });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}

// POST /api/access/requests: public endpoint for guest to submit access request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = GuestRequestCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid request format', 400, parseResult.error.format());
    }

    const { deviceId, guestName, requestedMinutes, reason } = parseResult.data;

    // Check device existence & persist to Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      let targetDevice: any = null;

      const { data: device } = await supabase
        .from('devices')
        .select('id, device_name, owner_id')
        .eq('id', deviceId)
        .maybeSingle();

      if (device) {
        targetDevice = device;
      } else {
        const { data: devByUuid } = await supabase
          .from('devices')
          .select('id, device_name, owner_id')
          .eq('device_uuid', deviceId)
          .maybeSingle();
        targetDevice = devByUuid;
      }

      if (!targetDevice) {
        return errorResponse('DEVICE_NOT_FOUND', 'Target device not found', 404);
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: newSession, error: sessErr } = await supabase
        .from('access_sessions')
        .insert({
          device_id: targetDevice.id,
          owner_id: targetDevice.owner_id,
          session_type: 'temporary_access',
          status: 'PENDING',
          duration_minutes: requestedMinutes,
          created_by: targetDevice.owner_id,
          expires_at: expiresAt,
          metadata: {
            guestName,
            reason: reason || null,
            isGuestRequest: true,
          },
        })
        .select()
        .single();

      if (!sessErr && newSession) {
        const guestReq = {
          id: newSession.id,
          deviceId: targetDevice.id,
          guestName,
          requestedMinutes,
          reason,
          status: 'PENDING',
          createdAt: newSession.created_at,
        };

        demoStore.createGuestRequest({
          deviceId: targetDevice.id,
          guestName,
          requestedMinutes,
          reason,
        });

        return jsonResponse({
          success: true,
          message: 'Access request submitted. Waiting for owner approval.',
          request: guestReq,
        });
      }
    }

    const guestRequest = demoStore.createGuestRequest({
      deviceId,
      guestName,
      requestedMinutes,
      reason,
    });

    return jsonResponse({
      success: true,
      message: 'Access request submitted. Waiting for owner approval.',
      request: guestRequest,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
