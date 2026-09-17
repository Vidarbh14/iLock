import { AgentChallengeRequestSchema } from '@ilock/shared';
import { generateChallengeNonce } from '@ilock/security';
import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = AgentChallengeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid challenge request', 400);
    }

    const { deviceUuid } = parseResult.data;
    const challengeNonce = generateChallengeNonce();
    const expiresAt = new Date(Date.now() + 120 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device } = await supabase
        .from('devices')
        .select('id')
        .eq('device_uuid', deviceUuid)
        .single();

      if (!device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device UUID not registered', 404);
      }

      await supabase.from('device_credentials').upsert(
        {
          device_id: device.id,
          current_challenge_nonce: challengeNonce,
          challenge_expires_at: expiresAt,
        },
        { onConflict: 'device_id' }
      );

      return jsonResponse({
        challengeNonce,
        expiresAt,
        serverTimeUtc: new Date().toISOString(),
      });
    }

    // Demo Mode Store
    const device = demoStore.getDeviceByUuid(deviceUuid);
    if (!device) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device UUID not recognized in demo store', 404);
    }

    return jsonResponse({
      challengeNonce,
      expiresAt,
      serverTimeUtc: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
