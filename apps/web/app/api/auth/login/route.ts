import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient, createServiceClient } from '@/lib/supabase-server';
import { DEMO_USER_ID } from '@/lib/demo-store';

const LEGACY_DEMO_OWNER_ID = 'c60ba6f8-265f-4191-8ab2-9bf1316c43e3';

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

    // Instant Sandbox / Demo access
    if (normalizedEmail === 'demo@ilock.security' || !isSupabaseConfigured()) {
      return jsonResponse({
        success: true,
        user: { id: DEMO_USER_ID, email: 'demo@ilock.security' },
        session: null,
        isDemo: true,
        message: 'Signed in as Demo Owner',
      });
    }

    if (!password || typeof password !== 'string') {
      return errorResponse('INVALID_PASSWORD', 'Password is required', 400);
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

    // Ensure devices belong to logged in owner if not already reassigned
    try {
      const adminClient = createServiceClient();
      await adminClient
        .from('devices')
        .update({ owner_id: user.id })
        .eq('owner_id', LEGACY_DEMO_OWNER_ID);

      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'USER_LOGIN',
        success: true,
        reason: `Owner signed in: ${normalizedEmail}`,
        details: { email: normalizedEmail, userId: user.id },
      });
    } catch (e) {
      console.warn('[iLock Auth] Post-login hook notice:', e);
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
