import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { GuestRequestCreateSchema } from '@ilock/shared';

// GET /api/access/requests: lists pending guest requests
export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || undefined;

    // Demo store returns immediate mock/stored requests
    const requests = demoStore.getGuestRequests(deviceId);
    return jsonResponse({ requests });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}

// POST /api/access/requests: public endpoint for guest to submit access request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = GuestRequestCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid request format', 400, parseResult.error.format());
    }

    const { deviceId, guestName, requestedMinutes, reason } = parseResult.data;

    // Check device existence
    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device } = await supabase
        .from('devices')
        .select('id, device_name')
        .eq('id', deviceId)
        .single();

      if (!device) {
        // Also check by device_uuid
        const { data: devByUuid } = await supabase
          .from('devices')
          .select('id, device_name')
          .eq('device_uuid', deviceId)
          .single();

        if (!devByUuid) {
          return errorResponse('DEVICE_NOT_FOUND', 'Target device not found', 404);
        }
      }
    }

    const guestRequest = demoStore.createGuestRequest({
      deviceId,
      guestName,
      requestedMinutes,
      reason,
    });

    return jsonResponse({
      success: true,
      message: 'Access request submitted. Waiting for owner approval.',
      request: guestRequest,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
