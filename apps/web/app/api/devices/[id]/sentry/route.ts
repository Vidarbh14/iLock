import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { SentryConfigSchema } from '@ilock/shared';
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
      // Fetch latest intruder alert from audit_logs
      const { data: alerts } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('device_id', deviceId)
        .eq('event_type', 'INTRUDER_ALERT')
        .order('created_at', { ascending: false })
        .limit(5);

      return jsonResponse({
        success: true,
        alerts: alerts || [],
      });
    }

    return jsonResponse({ success: true, alerts: [] });
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
    const parseResult = SentryConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid sentry payload', 400, parseResult.error.format());
    }

    const config = parseResult.data;
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

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
        payload: {
          action: 'SENTRY_CONFIG',
          ...config,
          requestedBy: userId,
        },
        expires_at: expiresAt,
      });

      return jsonResponse({
        success: true,
        message: `Sentry Mode ${config.enabled ? 'Armed' : 'Disarmed'}`,
      });
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: { action: 'SENTRY_CONFIG', ...config },
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
      message: `Sentry Mode ${config.enabled ? 'Armed' : 'Disarmed'} (Demo mode)`,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
