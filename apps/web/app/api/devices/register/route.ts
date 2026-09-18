import { RegisterDeviceSchema } from '@ilock/shared';
import { hashPairingCode, pairingRateLimiter, normalizePem } from '@ilock/security';
import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    // Rate limit pairing attempts per IP to prevent brute-forcing
    const rateCheck = pairingRateLimiter.check(`register:${ip}`, 60000, 10);
    if (!rateCheck.success) {
      return errorResponse('RATE_LIMIT_EXCEEDED', 'Too many registration attempts. Try again later.', 429);
    }

    const body = await request.json();
    const parseResult = RegisterDeviceSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid registration parameters', 400, parseResult.error.format());
    }

    const { pairingCode, deviceUuid, hostname, osVersion, agentVersion, publicKey, publicKeyAlgorithm } =
      parseResult.data;

    const normalizedCode = pairingCode.replace(/[\s-]/g, '').toUpperCase();
    const pairingHash = hashPairingCode(normalizedCode);
    const now = new Date();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      // Find valid unused pairing request
      const { data: pairingReq, error: findError } = await supabase
        .from('pairing_requests')
        .select('*')
        .eq('pairing_code_hash', pairingHash)
        .eq('is_used', false)
        .gt('expires_at', now.toISOString())
        .single();

      if (findError || !pairingReq) {
        return errorResponse(
          'INVALID_PAIRING_CODE',
          `Invalid or expired pairing code. (${findError?.message || 'No match'})`,
          400,
          { pairingHash, dbError: findError }
        );
      }

      // Mark pairing code as used immediately
      await supabase
        .from('pairing_requests')
        .update({ is_used: true, used_at: now.toISOString() })
        .eq('id', pairingReq.id);

      // Register or update device
      const authToken = crypto.randomBytes(32).toString('hex');
      const hashedAuthToken = crypto.createHash('sha256').update(authToken).digest('hex');

      const { data: device, error: devError } = await supabase
        .from('devices')
        .upsert(
          {
            owner_id: pairingReq.owner_id,
            device_name: pairingReq.device_name,
            device_uuid: deviceUuid,
            platform: 'windows',
            hostname,
            os_version: osVersion,
            agent_version: agentVersion,
            public_key: normalizePem(publicKey),
            public_key_algorithm: publicKeyAlgorithm,
            last_seen: now.toISOString(),
            status: 'online',
            is_trusted: true,
          },
          { onConflict: 'device_uuid' }
        )
        .select()
        .single();

      if (devError) {
        return errorResponse('DB_ERROR', 'Failed to register device', 500, devError.message);
      }

      // Store device credential
      await supabase.from('device_credentials').upsert(
        {
          device_id: device.id,
          hashed_auth_token: hashedAuthToken,
          last_authenticated_at: now.toISOString(),
        },
        { onConflict: 'device_id' }
      );

      // Add device telemetry row
      await supabase.from('device_status').upsert(
        {
          device_id: device.id,
          workstation_locked: true,
          last_heartbeat: now.toISOString(),
          consecutive_failed_heartbeats: 0,
        },
        { onConflict: 'device_id' }
      );

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: pairingReq.owner_id,
        device_id: device.id,
        event_type: 'DEVICE_REGISTERED',
        success: true,
        reason: 'Device successfully paired and registered',
        details: { hostname, agentVersion, deviceUuid },
      });

      return jsonResponse({
        success: true,
        deviceId: device.id,
        deviceUuid: device.device_uuid,
        authToken,
        message: 'Device successfully registered with iLock Cloud',
      });
    }

    // Demo Mode Store Registration
    const matchedReq = demoStore.pairingRequests.find(
      (r) =>
        !r.isUsed &&
        r.pairingCode.replace(/[\s-]/g, '').toUpperCase() === normalizedCode &&
        new Date(r.expiresAt) > now
    );

    const ownerId = matchedReq?.ownerId ?? DEMO_USER_ID;
    const deviceName = matchedReq?.deviceName ?? hostname ?? 'New Windows PC';

    if (matchedReq) {
      matchedReq.isUsed = true;
      matchedReq.usedAt = now.toISOString();
    }

    const newDeviceId = crypto.randomUUID();
    const authToken = crypto.randomBytes(32).toString('hex');

    demoStore.addDevice({
      id: newDeviceId,
      ownerId,
      deviceName,
      deviceUuid,
      platform: 'windows',
      hostname,
      osVersion: osVersion ?? 'Windows 11 Pro',
      agentVersion: agentVersion ?? '1.0.0',
      publicKey,
      publicKeyAlgorithm: publicKeyAlgorithm ?? 'RSA-4096',
      lastSeen: now.toISOString(),
      status: 'online',
      isTrusted: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    demoStore.telemetry.set(newDeviceId, {
      deviceId: newDeviceId,
      ipHash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16),
      cpuUsagePct: 10.0,
      memoryUsagePct: 35.0,
      batteryPct: 100.0,
      isCharging: true,
      activeUser: 'windows_user',
      workstationLocked: true,
      lastHeartbeat: now.toISOString(),
      consecutiveFailedHeartbeats: 0,
      updatedAt: now.toISOString(),
    });

    demoStore.addAuditLog({
      userId: ownerId,
      deviceId: newDeviceId,
      eventType: 'DEVICE_REGISTERED',
      success: true,
      reason: 'Device paired and cryptographic public key enrolled',
      details: { hostname, agentVersion, deviceUuid },
    });

    return jsonResponse({
      success: true,
      deviceId: newDeviceId,
      deviceUuid,
      authToken,
      message: 'Device successfully registered (Demo sandbox)',
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message || 'Registration failure', 500);
  }
}
