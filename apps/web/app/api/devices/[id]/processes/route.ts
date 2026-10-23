import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { ProcessActionSchema } from '@ilock/shared';
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
      const { data: latest } = await supabase
        .from('authorization_requests')
        .select('result_error, acknowledged_at, result_status')
        .eq('device_id', deviceId)
        .eq('is_acknowledged', true)
        .eq('result_status', 'PROCESS_LIST')
        .order('acknowledged_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest && latest.result_error) {
        try {
          const list = JSON.parse(latest.result_error);
          return jsonResponse({ success: true, processes: list, updatedAt: latest.acknowledged_at });
        } catch {}
      }
    }

    // Default demo processes
    const demoProcesses = [
      { Pid: 10420, Name: 'chrome', Title: 'Google Chrome (12 tabs)', MemoryMb: 1450, CanKill: true },
      { Pid: 15980, Name: 'Code', Title: 'iLock - Visual Studio Code', MemoryMb: 890, CanKill: true },
      { Pid: 7890, Name: 'Discord', Title: 'Discord', MemoryMb: 420, CanKill: true },
      { Pid: 4120, Name: 'Spotify', Title: 'Spotify Premium', MemoryMb: 280, CanKill: true },
      { Pid: 2310, Name: 'steam', Title: 'Steam Client Bootstrapper', MemoryMb: 190, CanKill: true },
    ];

    return jsonResponse({ success: true, processes: demoProcesses, updatedAt: new Date().toISOString() });
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
    const parseResult = ProcessActionSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid process action payload', 400, parseResult.error.format());
    }

    const { action, pid } = parseResult.data;
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
          action: 'PROCESS_ACTION',
          actionType: action,
          pid,
          requestedBy: userId,
        },
        expires_at: expiresAt,
      });

      return jsonResponse({ success: true, message: `Process command '${action}' dispatched` });
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: { action: 'PROCESS_ACTION', actionType: action, pid },
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

    return jsonResponse({ success: true, message: `Process command '${action}' simulated (Demo mode)` });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
