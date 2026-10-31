import { AgentHeartbeatSchema } from '@ilock/shared';
import { globalReplayDetector, heartbeatRateLimiter, hashIpAddress, verifyHeartbeatSignature } from '@ilock/security';
import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import {
  resolveLocationFix,
  isNewFix,
  haversineMeters,
  LOCATION_HISTORY_MIN_DISTANCE_M,
  LOCATION_HISTORY_MIN_INTERVAL_MS,
  LOCATION_RETENTION_MS,
  type StoredLocation,
} from '@/lib/location-helper';

export async function POST(request: Request) {
  try {
    const rawIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const ipHash = hashIpAddress(rawIp);

    const body = await request.json();
    const parseResult = AgentHeartbeatSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid heartbeat format', 400, parseResult.error.format());
    }

    const {
      deviceUuid,
      timestamp,
      nonce,
      workstationLocked,
      cpuUsagePct,
      memoryUsagePct,
      batteryPct,
      isCharging,
      activeUser,
    } = parseResult.data;

    // Rate limiting (supports fast 400ms responsive polling when locked: up to 240 req/min)
    const rateCheck = heartbeatRateLimiter.check(`hb:${deviceUuid}`, 60000, 240);
    if (!rateCheck.success) {
      return errorResponse('RATE_LIMIT_EXCEEDED', 'Heartbeat flood detected', 429);
    }

    // Replay Protection
    const replayCheck = globalReplayDetector.validate(nonce, timestamp);
    if (!replayCheck.valid) {
      return errorResponse('REPLAY_DETECTED', replayCheck.reason || 'Heartbeat rejected', 400);
    }

    const now = new Date();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      // Retrieve device (with last known location for fix comparison)
      let locationSchemaReady = true;
      let { data: device, error: devError } = await supabase
        .from('devices')
        .select('id, owner_id, public_key, device_status (latitude, longitude, location_source, location_fixed_at)')
        .eq('device_uuid', deviceUuid)
        .single();

      // Location migration not applied yet (undefined column): keep heartbeats working without location
      if (devError?.code === '42703') {
        locationSchemaReady = false;
        ({ data: device, error: devError } = await supabase
          .from('devices')
          .select('id, owner_id, public_key')
          .eq('device_uuid', deviceUuid)
          .single());
      }

      if (devError || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device UUID not registered', 404);
      }

      // Cryptographic signature verification with registered public key (covers lock state and location)
      if (!device.public_key || !verifyHeartbeatSignature(device.public_key, parseResult.data, parseResult.data.signature)) {
        return errorResponse('INVALID_SIGNATURE', 'Heartbeat signature mismatch. Heartbeat rejected.', 403);
      }

      const deviceStatus = 'device_status' in device ? device.device_status : undefined;
      const prevStatus = (Array.isArray(deviceStatus) ? deviceStatus[0] : deviceStatus) as StoredLocation | undefined;
      const fix = locationSchemaReady
        ? resolveLocationFix(parseResult.data, request.headers, prevStatus ?? null, now)
        : null;

      // Update device last seen
      await supabase
        .from('devices')
        .update({
          last_seen: now.toISOString(),
          status: 'online',
          updated_at: now.toISOString(),
        })
        .eq('id', device.id);

      // Update telemetry
      await supabase.from('device_status').upsert(
        {
          device_id: device.id,
          ip_hash: ipHash,
          cpu_usage_pct: cpuUsagePct,
          memory_usage_pct: memoryUsagePct,
          battery_pct: batteryPct,
          is_charging: isCharging,
          active_user: activeUser,
          workstation_locked: workstationLocked,
          last_heartbeat: now.toISOString(),
          consecutive_failed_heartbeats: 0,
          // Only overwrite location when a fix exists, so the last known location survives
          ...(fix && {
            latitude: fix.latitude,
            longitude: fix.longitude,
            location_accuracy_m: fix.accuracyM,
            location_source: fix.source,
            location_city: fix.city,
            location_fixed_at: fix.fixedAt,
          }),
        },
        { onConflict: 'device_id' }
      );

      // Append to the movement trail (throttled by distance / time)
      if (fix && isNewFix(fix, prevStatus ?? null)) {
        const { data: lastRows } = await supabase
          .from('device_locations')
          .select('latitude, longitude, recorded_at')
          .eq('device_id', device.id)
          .order('recorded_at', { ascending: false })
          .limit(1);

        const last = lastRows?.[0];
        const shouldRecord = !last
          || haversineMeters(last.latitude, last.longitude, fix.latitude, fix.longitude) >= LOCATION_HISTORY_MIN_DISTANCE_M
          || new Date(fix.fixedAt).getTime() - new Date(last.recorded_at).getTime() >= LOCATION_HISTORY_MIN_INTERVAL_MS;

        if (shouldRecord) {
          await supabase.from('device_locations').insert({
            device_id: device.id,
            latitude: fix.latitude,
            longitude: fix.longitude,
            accuracy_m: fix.accuracyM,
            source: fix.source,
            city: fix.city,
            recorded_at: fix.fixedAt,
          });

          // 7-day retention
          await supabase
            .from('device_locations')
            .delete()
            .eq('device_id', device.id)
            .lt('recorded_at', new Date(now.getTime() - LOCATION_RETENTION_MS).toISOString());
        }
      }

      // Fetch pending unacknowledged commands
      const { data: commands } = await supabase
        .from('authorization_requests')
        .select('*')
        .eq('device_id', device.id)
        .eq('is_acknowledged', false)
        .eq('is_dispatched', false)
        .gt('expires_at', now.toISOString())
        .order('created_at', { ascending: true });

      // Mark dispatched
      if (commands && commands.length > 0) {
        const ids = commands.map((c) => c.id);
        await supabase
          .from('authorization_requests')
          .update({ is_dispatched: true, dispatched_at: now.toISOString() })
          .in('id', ids);
      }

      return jsonResponse({
        acknowledged: true,
        serverTimeUtc: now.toISOString(),
        pendingCommands: (commands || []).map((c) => ({
          id: c.id,
          commandType: c.command_type,
          sessionId: c.session_id,
          nonce: c.nonce,
          expiresAt: c.expires_at,
          payload: c.payload,
        })),
      });
    }

    // Demo Mode Store Heartbeat
    const device = demoStore.getDeviceByUuid(deviceUuid);
    if (!device) {
      return errorResponse('DEVICE_NOT_FOUND', 'Device UUID not recognized in demo store', 404);
    }

    device.lastSeen = now.toISOString();
    device.status = 'online';
    device.updatedAt = now.toISOString();

    const prevTelemetry = demoStore.telemetry.get(device.id);
    const prevLoc = prevTelemetry?.location;
    const demoFix = resolveLocationFix(
      parseResult.data,
      request.headers,
      prevLoc
        ? { latitude: prevLoc.latitude, longitude: prevLoc.longitude, location_source: prevLoc.source, location_fixed_at: prevLoc.fixedAt }
        : null,
      now
    );

    demoStore.telemetry.set(device.id, {
      location: demoFix ?? prevLoc ?? null,
      deviceId: device.id,
      ipHash,
      cpuUsagePct: cpuUsagePct ?? 14.0,
      memoryUsagePct: memoryUsagePct ?? 45.0,
      batteryPct: batteryPct ?? 100.0,
      isCharging: isCharging ?? true,
      activeUser: activeUser ?? 'vidarbh',
      workstationLocked,
      lastHeartbeat: now.toISOString(),
      consecutiveFailedHeartbeats: 0,
      updatedAt: now.toISOString(),
    });

    const pending = demoStore.pullPendingCommands(deviceUuid);

    return jsonResponse({
      acknowledged: true,
      serverTimeUtc: now.toISOString(),
      pendingCommands: pending.map((c) => ({
        id: c.id,
        commandType: c.commandType,
        sessionId: c.sessionId,
        nonce: c.nonce,
        expiresAt: c.expiresAt,
        payload: c.payload,
      })),
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
