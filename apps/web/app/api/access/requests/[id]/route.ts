import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { demoStore } from '@/lib/demo-store';

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
