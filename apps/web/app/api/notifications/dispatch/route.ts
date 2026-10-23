import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId && isSupabaseConfigured()) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await request.json();
    const { title, body: msgBody, deviceId, url } = body || {};

    // Broadcast through Realtime
    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const channel = supabase.channel(`user-notifications:${userId}`);
      await channel.send({
        type: 'broadcast',
        event: 'web_push',
        payload: {
          title: title || 'iLock Workstation Alert',
          body: msgBody || 'A security event has been logged for your PC.',
          deviceId,
          url: url || '/dashboard',
          timestamp: Date.now(),
        },
      });
      await supabase.removeChannel(channel);
    }

    return jsonResponse({
      success: true,
      message: 'Notification dispatched successfully',
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
