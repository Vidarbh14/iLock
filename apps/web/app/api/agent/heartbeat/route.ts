import { AgentHeartbeatSchema } from '@ilock/shared';
import { globalReplayDetector, heartbeatRateLimiter, hashIpAddress } from '@ilock/security';
import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';

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

    // Rate limiting
    const rateCheck = heartbeatRateLimiter.check(`hb:${deviceUuid}`, 60000, 60);
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

      // Retrieve device
      const { data: device, error: devError } = await supabase
        .from('devices')
        .select('id, owner_id')
        .eq('device_uuid', deviceUuid)
        .single();

      if (devError || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device UUID not registered', 404);
      }

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
        },
        { onConflict: 'device_id' }
      );

      // Fetch pending unacknowledged commands
      const { data: commands } = await supabase
        .from('authorization_requests')
        .select('*')
        .eq('device_id', device.id)
        .eq('is_acknowledged', false)
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

    demoStore.telemetry.set(device.id, {
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
