import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import crypto from 'node:crypto';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: requestId } = params;
    const body = await request.json();
    const action = String(body?.action || '').toUpperCase(); // 'APPROVE' or 'REJECT'

    if (action === 'APPROVE') {
      if (isSupabaseConfigured()) {
        const supabase = createServiceClient();
        const { data: session } = await supabase
          .from('access_sessions')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (session) {
          if (session.owner_id !== userId) {
            return errorResponse('FORBIDDEN', 'You do not have permission to approve access for this workstation', 403);
          }
          const now = new Date();
          const expiresAt = new Date(now.getTime() + (session.duration_minutes || 30) * 60 * 1000);

          await supabase
            .from('access_sessions')
            .update({
              status: 'ACTIVE',
              activated_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', requestId);

          // Enqueue UNLOCK command for the device using standard CREATE_ACCESS_SESSION with isUnlock: true
          await supabase.from('authorization_requests').insert({
            device_id: session.device_id,
            session_id: session.id,
            command_type: 'CREATE_ACCESS_SESSION',
            nonce: crypto.randomUUID(),
            payload: {
              action: 'UNLOCK',
              isUnlock: true,
              durationMinutes: session.duration_minutes,
              guestName: session.metadata?.guestName,
            },
            expires_at: new Date(now.getTime() + 60 * 1000).toISOString(),
          });

          return jsonResponse({
            success: true,
            message: `Guest access granted for ${session.metadata?.guestName || 'guest'}`,
            request: {
              id: session.id,
              deviceId: session.device_id,
              guestName: session.metadata?.guestName || 'Guest',
              status: 'APPROVED',
            },
            session,
          });
        }
      }

      const result = demoStore.approveGuestRequest(requestId, userId);
      if (!result) {
        return errorResponse('REQUEST_NOT_FOUND', 'Guest request not found', 404);
      }
      return jsonResponse({
        success: true,
        message: `Guest access granted for ${result.request.guestName}`,
        request: result.request,
        session: result.session,
      });
    } else if (action === 'REJECT') {
      if (isSupabaseConfigured()) {
        const supabase = createServiceClient();
        const { data: session } = await supabase
          .from('access_sessions')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (session) {
          if (session.owner_id !== userId) {
            return errorResponse('FORBIDDEN', 'You do not have permission to decline access for this workstation', 403);
          }
          const now = new Date();
          await supabase
            .from('access_sessions')
            .update({
              status: 'REVOKED',
              revoked_at: now.toISOString(),
              revoked_by: userId,
              failure_reason: 'Declined by owner',
              updated_at: now.toISOString(),
            })
            .eq('id', requestId);

          return jsonResponse({
            success: true,
            message: `Guest request from ${session.metadata?.guestName || 'guest'} was declined`,
            request: {
              id: session.id,
              deviceId: session.device_id,
              guestName: session.metadata?.guestName || 'Guest',
              status: 'REJECTED',
            },
          });
        }
      }

      const rejected = demoStore.rejectGuestRequest(requestId, userId);
      if (!rejected) {
        return errorResponse('REQUEST_NOT_FOUND', 'Guest request not found', 404);
      }
      return jsonResponse({
        success: true,
        message: `Guest request from ${rejected.guestName} was declined`,
        request: rejected,
      });
    } else {
      return errorResponse('INVALID_ACTION', "Action must be 'APPROVE' or 'REJECT'", 400);
    }
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
