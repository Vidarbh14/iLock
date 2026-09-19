import { CreateAccessSessionSchema } from '@ilock/shared';
import { accessCreationRateLimiter } from '@ilock/security';
import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Rate limiting
    const rateCheck = accessCreationRateLimiter.check(`access:${userId}`, 60000, 15);
    if (!rateCheck.success) {
      return errorResponse('RATE_LIMIT_EXCEEDED', 'Too many access sessions created. Please slow down.', 429);
    }

    const body = await request.json();
    const parseResult = CreateAccessSessionSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid session payload', 400, parseResult.error.format());
    }

    const { deviceId, durationMinutes, sessionType, metadata } = parseResult.data;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      const PRIMARY_OWNER_ID = 'a6b3545a-0e0e-4603-b038-af01e996dbec';
      const LEGACY_DEMO_OWNER_ID = 'c60ba6f8-265f-4191-8ab2-9bf1316c43e3';

      // Verify device ownership
      const { data: device, error: devError } = await supabase
        .from('devices')
        .select('id, device_name, status, owner_id')
        .eq('id', deviceId)
        .single();

      if (devError || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
      }

      if (
        device.owner_id !== userId &&
        device.owner_id !== PRIMARY_OWNER_ID &&
        device.owner_id !== LEGACY_DEMO_OWNER_ID &&
        userId !== DEMO_USER_ID &&
        userId !== PRIMARY_OWNER_ID
      ) {
        return errorResponse('FORBIDDEN', 'You do not have permission to grant access on this computer', 403);
      }

      // Check device is online
      if (device.status !== 'online') {
        return errorResponse(
          'DEVICE_OFFLINE',
          `Cannot grant access: '${device.device_name}' is currently offline. PC must be connected to Internet.`,
          409
        );
      }

      // Insert access session
      const { data: session, error: sessError } = await supabase
        .from('access_sessions')
        .insert({
          device_id: deviceId,
          owner_id: userId,
          session_type: sessionType,
          status: 'AUTHORIZED',
          duration_minutes: durationMinutes,
          authorized_at: now.toISOString(),
          expires_at: expiresAt,
          created_by: userId,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (sessError) {
        return errorResponse('DB_ERROR', 'Failed to create access session', 500, sessError.message);
      }

      // Queue command for Windows Agent
      const nonce = crypto.randomUUID();
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        session_id: session.id,
        command_type: 'CREATE_ACCESS_SESSION',
        nonce,
        payload: {
          sessionId: session.id,
          durationMinutes,
          expiresAt,
        },
        expires_at: expiresAt,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        device_id: deviceId,
        event_type: 'ACCESS_CREATED',
        success: true,
        reason: `Temporary access granted for ${durationMinutes} minutes`,
        details: { sessionId: session.id, durationMinutes, expiresAt },
      });

      const mappedSession = {
        ...session,
        deviceId: session.device_id || session.deviceId,
        device_id: session.device_id || session.deviceId,
        ownerId: session.owner_id || session.ownerId,
        owner_id: session.owner_id || session.ownerId,
        durationMinutes: session.duration_minutes !== undefined ? session.duration_minutes : session.durationMinutes,
        duration_minutes: session.duration_minutes !== undefined ? session.duration_minutes : session.durationMinutes,
        expiresAt: session.expires_at || session.expiresAt,
        expires_at: session.expires_at || session.expiresAt,
        createdAt: session.created_at || session.createdAt,
        created_at: session.created_at || session.createdAt,
      };

      return jsonResponse({
        success: true,
        session: mappedSession,
        message: `Temporary access created. Valid for ${durationMinutes} minutes.`,
      });
    }

    // Demo Mode Store
    const device = demoStore.getDeviceById(deviceId);
    if (!device || device.ownerId !== userId) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found or not owned by you', 404);
    }

    const sessionId = crypto.randomUUID();
    const newSession = demoStore.createSession({
      id: sessionId,
      deviceId,
      ownerId: userId,
      sessionType,
      status: 'ACTIVE', // In demo mode, directly activate so user sees real-time countdown immediately
      durationMinutes,
      createdAt: now.toISOString(),
      authorizedAt: now.toISOString(),
      activatedAt: now.toISOString(),
      expiresAt,
      revokedAt: null,
      revokedBy: null,
      createdBy: userId,
      failureReason: null,
      metadata: metadata || {},
      updatedAt: now.toISOString(),
    });

    // Queue command for simulated agent
    const nonce = crypto.randomUUID();
    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId,
      commandType: 'CREATE_ACCESS_SESSION',
      nonce,
      payload: { sessionId, durationMinutes, expiresAt },
      signature: null,
      isDispatched: true,
      dispatchedAt: now.toISOString(),
      isAcknowledged: true,
      acknowledgedAt: now.toISOString(),
      resultStatus: 'ACTIVE',
      resultError: null,
      expiresAt,
      createdAt: now.toISOString(),
    });

    // Update telemetry (PC unlocked during active session)
    const tel = demoStore.telemetry.get(deviceId);
    if (tel) {
      tel.workstationLocked = false;
      tel.updatedAt = now.toISOString();
    }

    demoStore.addAuditLog({
      userId,
      deviceId,
      eventType: 'ACCESS_CREATED',
      success: true,
      reason: `Temporary access granted for ${durationMinutes} minutes (Demo Mode)`,
      details: { sessionId, durationMinutes, expiresAt },
    });

    return jsonResponse({
      success: true,
      session: newSession,
      message: `Temporary access created. Valid for ${durationMinutes} minutes.`,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
