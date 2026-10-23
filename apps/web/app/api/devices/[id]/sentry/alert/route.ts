import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: deviceIdOrUuid } = params;
    const body = await request.json();

    const reason = String(body?.reason || 'Intruder / Tamper Detected');
    const photoBase64 = String(body?.photoBase64 || '');
    const timestamp = Number(body?.timestamp || Date.now());

    let targetDeviceId = deviceIdOrUuid;

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      // Resolve device
      const { data: dev } = await supabase
        .from('devices')
        .select('id, owner_id, device_name')
        .or(`id.eq.${deviceIdOrUuid},device_uuid.eq.${deviceIdOrUuid}`)
        .maybeSingle();

      if (dev) {
        targetDeviceId = dev.id;

        // Insert into audit logs
        await supabase.from('audit_logs').insert({
          user_id: dev.owner_id,
          device_id: dev.id,
          event_type: 'INTRUDER_ALERT',
          success: false,
          reason,
          details: {
            reason,
            photoBase64: photoBase64 || null,
            timestamp,
            deviceName: dev.device_name,
          },
        });

        // Broadcast to owner's alert channel
        try {
          const channel = supabase.channel(`device-alerts:${dev.id}`);
          await channel.send({
            type: 'broadcast',
            event: 'intruder_alert',
            payload: {
              deviceId: dev.id,
              deviceName: dev.device_name,
              reason,
              photoBase64,
              timestamp,
            },
          });
          await supabase.removeChannel(channel);
        } catch {}
      }
    }

    return jsonResponse({ success: true, message: 'Intruder alert registered' });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
