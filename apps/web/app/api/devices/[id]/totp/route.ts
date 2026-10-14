import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { deriveDeviceTotpSecret, generateTotpCode, verifyTotpCode } from '@ilock/security';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    let deviceUuid: string | null = null;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, device_uuid, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device || device.owner_id !== userId) {
        return errorResponse('FORBIDDEN', 'Access denied to this device', 403);
      }
      deviceUuid = device.device_uuid;
    } else {
      const device = demoStore.getDeviceById(deviceId);
      if (!device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found in demo store', 404);
      }
      deviceUuid = device.deviceUuid;
    }

    if (!deviceUuid) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device UUID not found', 404);
    }

    const secret = deriveDeviceTotpSecret(deviceUuid);
    const { code, secondsRemaining } = generateTotpCode(secret);

    return jsonResponse({
      deviceUuid,
      code,
      secondsRemaining,
      timeStepSeconds: 30,
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
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    const body = await request.json();
    const code = String(body?.code || '').trim();

    let deviceUuid: string | null = null;
    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device } = await supabase
        .from('devices')
        .select('id, device_uuid, owner_id')
        .eq('id', deviceId)
        .single();
      if (!device || device.owner_id !== userId) {
        return errorResponse('FORBIDDEN', 'Access denied', 403);
      }
      deviceUuid = device.device_uuid;
    } else {
      const device = demoStore.getDeviceById(deviceId);
      deviceUuid = device?.deviceUuid || null;
    }

    if (!deviceUuid) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
    }

    const secret = deriveDeviceTotpSecret(deviceUuid);
    const valid = verifyTotpCode(code, secret);

    return jsonResponse({
      valid,
      message: valid ? 'Emergency TOTP verified successfully' : 'Invalid or expired TOTP code',
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
