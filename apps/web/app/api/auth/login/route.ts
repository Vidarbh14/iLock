import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient, createServiceClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse('INVALID_JSON', 'Invalid JSON payload in request', 400);
    }

    const { email, password } = body || {};

    if (!email || typeof email !== 'string') {
      return errorResponse('INVALID_EMAIL', 'Email is required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!password || typeof password !== 'string') {
      return errorResponse('INVALID_PASSWORD', 'Password is required', 400);
    }

    if (!isSupabaseConfigured()) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Authentication service not configured', 503);
    }

    const serverClient = createServerClient();
    const { data: authData, error: authError } = await serverClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !authData.user) {
      return errorResponse(
        'INVALID_CREDENTIALS',
        authError?.message || 'Invalid email or password. Please try again.',
        401
      );
    }

    const user = authData.user;

    // Record login audit event
    try {
      const adminClient = createServiceClient();
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'USER_LOGIN',
        success: true,
        reason: `User signed in: ${normalizedEmail}`,
        details: { email: normalizedEmail, userId: user.id },
      });
    } catch (e) {
      console.warn('[iLock Auth] Post-login audit log notice:', e);
    }

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      session: authData.session,
      message: 'Signed in successfully',
    });
  } catch (err: any) {
    console.error('[iLock Auth] Login exception:', err);
    return errorResponse('INTERNAL_SERVER_ERROR', err.message || 'Login failed', 500);
  }
}
