import { NextResponse } from 'next/server';
import { CreatePairingRequestSchema } from '@ilock/shared';
import { generatePairingCode, hashPairingCode, pairingRateLimiter } from '@ilock/security';
import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required to create a pairing code', 401);
    }

    // Rate limiting check
    const rateCheck = pairingRateLimiter.check(`pair:${userId}`, 60000, 5);
    if (!rateCheck.success) {
      return errorResponse('RATE_LIMIT_EXCEEDED', 'Too many pairing requests. Please wait a moment.', 429);
    }

    const body = await request.json();
    const parseResult = CreatePairingRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid request body', 400, parseResult.error.format());
    }

    const { deviceName } = parseResult.data;
    const { formatted: pairingCode, raw: rawCode } = generatePairingCode();
    const pairingHash = hashPairingCode(rawCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('pairing_requests')
        .insert({
          owner_id: userId,
          pairing_code_hash: pairingHash,
          device_name: deviceName,
          expires_at: expiresAt,
          is_used: false,
        })
        .select('id, device_name, expires_at')
        .single();

      if (error) {
        return errorResponse('DB_ERROR', 'Failed to store pairing request', 500, error.message);
      }

      await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: 'PAIRING_CREATED',
        success: true,
        reason: `Pairing code requested for '${deviceName}'`,
        details: { deviceName },
      });

      return jsonResponse({
        id: data.id,
        deviceName: data.device_name,
        pairingCode,
        expiresAt: data.expires_at,
        expiresInSeconds: 600,
      });
    }

    // Demo Mode Store
    const reqId = crypto.randomUUID();
    demoStore.pairingRequests.push({
      id: reqId,
      ownerId: userId,
      deviceName,
      pairingCode,
      expiresAt,
      isUsed: false,
      usedAt: null,
      createdAt: new Date().toISOString(),
    });

    demoStore.addAuditLog({
      userId,
      deviceId: null,
      eventType: 'PAIRING_CREATED',
      success: true,
      reason: `Pairing code requested for '${deviceName}'`,
      details: { deviceName, pairingCode },
    });

    return jsonResponse({
      id: reqId,
      deviceName,
      pairingCode,
      expiresAt,
      expiresInSeconds: 600,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred', 500);
  }
}
