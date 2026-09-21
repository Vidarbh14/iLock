import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import crypto from 'node:crypto';

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
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      // Check device exists
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, device_name, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device) {
        return errorResponse('DEVICE_NOT_FOUND', 'Device not found', 404);
      }

      // Multi-tenant permission check: STRICTLY only the real device owner can lock this computer!
      if (device.owner_id !== userId) {
        return errorResponse('FORBIDDEN', 'You do not have permission to lock this computer', 403);
      }

      // Enqueue LOCK_REQUEST command
      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'LOCK_REQUEST',
        nonce,
        payload: { requestedBy: userId },
        expires_at: expiresAt,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: userId,
        device_id: deviceId,
        event_type: 'LOCK_REQUEST',
        success: true,
        reason: 'Workstation lock requested by remote owner',
        details: { deviceId },
      });

      return jsonResponse({ success: true, message: 'Workstation lock command dispatched' });
    }

    return errorResponse('NOT_SUPPORTED', 'Service unavailable', 503);
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
