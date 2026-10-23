import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore, DEMO_USER_ID } from '@/lib/demo-store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId && isSupabaseConfigured()) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    let status = demoStore.getStreamStatus(deviceId);
    let frame = demoStore.getLatestStreamFrame(deviceId);

    // If frame is null, attempt to resolve via alternate device ID / UUID key
    if (!frame && isSupabaseConfigured()) {
      try {
        const supabase = createServiceClient();
        const { data: dev } = await supabase
          .from('devices')
          .select('id, device_uuid')
          .or(`id.eq.${deviceId},device_uuid.eq.${deviceId}`)
          .maybeSingle();

        if (dev) {
          const alternateKey = dev.id === deviceId ? dev.device_uuid : dev.id;
          if (alternateKey) {
            frame = demoStore.getLatestStreamFrame(alternateKey) || frame;
            if (!status.isStreaming) {
              status = demoStore.getStreamStatus(alternateKey);
            }
          }
        }
      } catch {}
    }

    return jsonResponse({
      isStreaming: status.isStreaming,
      streamStatus: status,
      frame: frame || null,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
