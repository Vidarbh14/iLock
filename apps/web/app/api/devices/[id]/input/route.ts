import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { RemoteInputSchema } from '@ilock/shared';
import crypto from 'node:crypto';

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
    const parseResult = RemoteInputSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid remote input payload', 400, parseResult.error.format());
    }

    const inputData = parseResult.data;
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 1000).toISOString();

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

      // Enqueue input command
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING',
        nonce,
        payload: {
          action: 'REMOTE_INPUT',
          ...inputData,
          requestedBy: userId,
        },
        expires_at: expiresAt,
      });

      // Also broadcast over stream realtime channel for instantaneous execution
      try {
        const channel = supabase.channel(`device-stream:${deviceId}`);
        await channel.send({
          type: 'broadcast',
          event: 'input',
          payload: inputData,
        });
        await supabase.removeChannel(channel);
      } catch {}

      return jsonResponse({ success: true, message: 'Input command queued' });
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: { action: 'REMOTE_INPUT', ...inputData },
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

    return jsonResponse({ success: true, message: 'Input command simulated (Demo mode)' });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
