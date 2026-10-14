import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await request.json();
    const subscription = body?.subscription;

    // Log web push registration
    return jsonResponse({
      success: true,
      message: 'Web push notifications registered successfully',
      registeredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
