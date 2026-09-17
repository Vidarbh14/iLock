import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { isRevocable } from '@ilock/shared';
import crypto from 'node:crypto';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: sessionId } = params;
    let reason = 'Owner manual revocation';
    try {
      const body = await request.json();
      if (body?.reason) reason = String(body.reason).slice(0, 256);
    } catch {
      // Empty body is acceptable
    }

    const now = new Date();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      // Retrieve session
      const { data: session, error: findError } = await supabase
        .from('access_sessions')
        .select('*, devices (device_name)')
        .eq('id', sessionId)
        .eq('owner_id', userId)
        .single();

      if (findError || !session) {
        return errorResponse('SESSION_NOT_FOUND', 'Access session not found', 404);
      }

      if (!isRevocable(session.status)) {
        return errorResponse(
          'INVALID_STATE',
          `Cannot revoke session in '${session.status}' state. It is already terminated.`,
          400
        );
      }

      // Immediately update session to REVOKED in Cloud DB
      const { data: updatedSession, error: updateError } = await supabase
        .from('access_sessions')
        .update({
          status: 'REVOKED',
          revoked_at: now.toISOString(),
          revoked_by: userId,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) {
        return errorResponse('DB_ERROR', 'Failed to update session status', 500, updateError.message);
      }

      // Queue high-priority REVOKE_ACCESS_SESSION command for Windows Agent
      const nonce = crypto.randomUUID();
      await supabase.from('authorization_requests').insert({
        device_id: session.device_id,
        session_id: sessionId,
        command_type: 'REVOKE_ACCESS_SESSION',
        nonce,
        payload: { sessionId, reason },
        expires_at: new Date(Date.now() + 120 * 1000).toISOString(),
      });

      // Update device lock status
      await supabase
        .from('device_status')
        .update({ workstation_locked: true, updated_at: now.toISOString() })
        .eq('device_id', session.device_id);

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        device_id: session.device_id,
        event_type: 'ACCESS_REVOKED',
        success: true,
        reason,
        details: { sessionId },
      });

      return jsonResponse({
        success: true,
        session: updatedSession,
        message: 'Access session revoked immediately. Computer locked.',
      });
    }

    // Demo Mode Store Revocation
    const revoked = demoStore.revokeSession(sessionId, userId, reason);
    if (!revoked) {
      return errorResponse('SESSION_NOT_FOUND', 'Access session not found', 404);
    }

    return jsonResponse({
      success: true,
      session: revoked,
      message: 'Access session revoked immediately. Computer locked (Demo sandbox).',
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
