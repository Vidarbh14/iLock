import { CommandResultSchema } from '@ilock/shared';
import { globalReplayDetector, verifyDeviceSignature } from '@ilock/security';
import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = CommandResultSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid command result format', 400, parseResult.error.format());
    }

    const { commandId, sessionId, status, resultStatus, error, nonce, timestamp, signature } =
      parseResult.data;

    // Replay protection
    const replayCheck = globalReplayDetector.validate(nonce, timestamp);
    if (!replayCheck.valid) {
      return errorResponse('REPLAY_DETECTED', replayCheck.reason || 'Command result rejected', 400);
    }

    const now = new Date();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      // Retrieve command
      const { data: cmd, error: cmdError } = await supabase
        .from('authorization_requests')
        .select('*, devices (public_key, owner_id)')
        .eq('id', commandId)
        .single();

      if (cmdError || !cmd) {
        return errorResponse('COMMAND_NOT_FOUND', 'Command not found', 404);
      }

      // Cryptographic signature verification with registered public key
      const expectedData = `${commandId}:${status}:${timestamp}:${nonce}`;
      const isSignatureValid = verifyDeviceSignature(cmd.devices.public_key, expectedData, signature);

      if (!isSignatureValid) {
        // Log critical security event
        await supabase.from('security_events').insert({
          device_id: cmd.device_id,
          user_id: cmd.devices.owner_id,
          event_type: 'INVALID_SIGNATURE',
          severity: 'critical',
          details: { commandId, nonce, reportedStatus: status },
        });

        return errorResponse('INVALID_SIGNATURE', 'Cryptographic signature mismatch. Command rejected.', 403);
      }

      // Mark command as acknowledged
      await supabase
        .from('authorization_requests')
        .update({
          is_acknowledged: true,
          acknowledged_at: now.toISOString(),
          result_status: resultStatus || status,
          result_error: error,
        })
        .eq('id', commandId);

      // If this was an access session authorization, transition session to ACTIVE
      if (cmd.command_type === 'CREATE_ACCESS_SESSION' && sessionId && status === 'SUCCESS') {
        await supabase
          .from('access_sessions')
          .update({
            status: 'ACTIVE',
            activated_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', sessionId);
      }

      return jsonResponse({ success: true, message: 'Command result acknowledged' });
    }

    // Demo Mode Store Command Result Handling
    const pendingCmd = demoStore.pendingCommands.find((c) => c.id === commandId);
    if (pendingCmd) {
      pendingCmd.isAcknowledged = true;
      pendingCmd.acknowledgedAt = now.toISOString();
      pendingCmd.resultStatus = resultStatus || status;
      pendingCmd.resultError = error ?? null;
    }

    if (sessionId && status === 'SUCCESS') {
      const session = demoStore.accessSessions.find((s) => s.id === sessionId);
      if (session) {
        session.status = 'ACTIVE';
        session.activatedAt = now.toISOString();
        session.updatedAt = now.toISOString();
      }
    }

    return jsonResponse({ success: true, message: 'Command result acknowledged (Demo mode)' });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
