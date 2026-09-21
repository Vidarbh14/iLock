import { errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient, createServerClient } from '@/lib/supabase-server';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return errorResponse('INVALID_EMAIL', 'Please enter a valid email address', 400);
    }

    if (!password || typeof password !== 'string') {
      return errorResponse('INVALID_PASSWORD', 'Password is required', 400);
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 8) {
      return errorResponse('WEAK_PASSWORD', 'Password must be at least 8 characters long', 400);
    }

    // Demo Mode Fallback
    if (!isSupabaseConfigured()) {
      return errorResponse('SERVICE_UNAVAILABLE', 'Registration service not configured', 503);
    }

    const adminClient = createServiceClient();

    // Check if account already exists
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (!listError && usersData?.users) {
      const existingUser = usersData.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );
      if (existingUser) {
        return errorResponse(
          'USER_EXISTS',
          'An account with this email already exists. Please sign in instead.',
          409
        );
      }
    }

    // Create user via Supabase Admin API with auto-confirmed email
    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: trimmedPassword,
      email_confirm: true,
    });

    if (createError || !createdUser.user) {
      console.error('[iLock Auth] Registration error:', createError);
      return errorResponse(
        'REGISTRATION_FAILED',
        createError?.message || 'Failed to create user account',
        400
      );
    }

    const newUser = createdUser.user;

    // Record audit event
    try {
      await adminClient.from('audit_logs').insert({
        user_id: newUser.id,
        event_type: 'USER_REGISTERED',
        success: true,
        reason: `User registered: ${normalizedEmail}`,
        details: { email: normalizedEmail, userId: newUser.id },
      });
    } catch (auditErr) {
      console.warn('[iLock Auth] Audit log error:', auditErr);
    }

    // Sign in on the server to populate SSR auth cookies
    let sessionData = null;
    try {
      const serverClient = createServerClient();
      const { data: signInData, error: signInErr } = await serverClient.auth.signInWithPassword({
        email: normalizedEmail,
        password: trimmedPassword,
      });

      if (!signInErr && signInData) {
        sessionData = signInData.session;
      }
    } catch (cookieErr) {
      console.warn('[iLock Auth] Cookie signin notice:', cookieErr);
    }

    return jsonResponse({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
      },
      session: sessionData,
      message: 'Account successfully registered and verified.',
    });
  } catch (err: any) {
    console.error('[iLock Auth] Unexpected signup exception:', err);
    return errorResponse('INTERNAL_SERVER_ERROR', err.message || 'Server error during signup', 500);
  }
}
