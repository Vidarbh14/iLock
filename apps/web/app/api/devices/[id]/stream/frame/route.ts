import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: deviceIdOrUuid } = params;
    const body = await request.json();

    const frameBase64 = String(body?.frameBase64 || body?.frame || '').trim();
    if (!frameBase64) {
      return errorResponse('INVALID_PAYLOAD', 'Frame data required', 400);
    }

    const timestamp = Number(body?.timestamp || Date.now());
    const fps = Number(body?.fps || 4);
    const activeWindow = String(body?.activeWindow || 'Windows Desktop');
    const mouseX = body?.mouseX !== undefined ? Number(body.mouseX) : undefined;
    const mouseY = body?.mouseY !== undefined ? Number(body.mouseY) : undefined;
    const streamSessionId = body?.streamSessionId ? String(body.streamSessionId) : null;

    let targetDeviceId = deviceIdOrUuid;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      // Resolve device ID if passed as UUID
      const { data: dev } = await supabase
        .from('devices')
        .select('id')
        .or(`id.eq.${deviceIdOrUuid},device_uuid.eq.${deviceIdOrUuid}`)
        .maybeSingle();

      if (dev) {
        targetDeviceId = dev.id;
      }

      // Broadcast immediately via Supabase Realtime Channel
      try {
        const channel = supabase.channel(`device-stream:${targetDeviceId}`);
        await channel.send({
          type: 'broadcast',
          event: 'frame',
          payload: {
            frameBase64,
            timestamp,
            fps,
            activeWindow,
            mouseX,
            mouseY,
            streamSessionId,
          },
        });
      } catch (broadcastErr) {
        // Fallback to in-memory caching
      }
    }

    // Always cache the latest frame in memory for instantaneous pull retrieval
    demoStore.saveStreamFrame(targetDeviceId, {
      frameBase64,
      timestamp,
      fps,
      activeWindow,
      mouseX,
      mouseY,
      streamSessionId,
    });

    return jsonResponse({
      success: true,
      deliveredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
