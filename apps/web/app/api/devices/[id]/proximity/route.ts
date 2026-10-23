import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { BleProximitySchema } from '@ilock/shared';
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
        .select('payload, acknowledged_at')
        .eq('device_id', deviceId)
        .contains('payload', { action: 'BLE_PROXIMITY' })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest && latest.payload) {
        return jsonResponse({
          success: true,
          proximity: {
            enabled: !!latest.payload.enabled,
            rssiThreshold: latest.payload.rssiThreshold ?? -75,
            timeoutSeconds: latest.payload.timeoutSeconds ?? 5,
            deviceAddress: latest.payload.deviceAddress ?? '',
          },
          updatedAt: latest.acknowledged_at,
        });
      }
    }

    return jsonResponse({
      success: true,
      proximity: {
        enabled: false,
        rssiThreshold: -75,
        timeoutSeconds: 5,
        deviceAddress: '',
      },
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
    const parseResult = BleProximitySchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid BLE proximity payload', 400, parseResult.error.format());
    }

    const proximityData = parseResult.data;
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
          action: 'BLE_PROXIMITY',
          ...proximityData,
          requestedBy: userId,
        },
        expires_at: expiresAt,
      });

      return jsonResponse({
        success: true,
        message: `BLE Proximity Auto-Lock ${proximityData.enabled ? 'activated' : 'deactivated'}`,
      });
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: { action: 'BLE_PROXIMITY', ...proximityData },
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
      message: `BLE Proximity updated (demo mode)`,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
