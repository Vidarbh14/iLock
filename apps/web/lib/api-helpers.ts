// ==============================================================================
// iLock API Helpers & Standardized Responses
// ==============================================================================

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createServerClient, createServiceClient } from './supabase-server';

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Extracts authenticated user ID from the request session or Authorization Bearer header.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUserId(request?: Request): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    // 1. Check cookies via Server Client
    const supabase = createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user?.id) {
      return user.id;
    }

    // 2. Check Authorization Bearer header if passed
    if (request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) {
          const serviceClient = createServiceClient();
          const { data: jwtUser, error: jwtErr } = await serviceClient.auth.getUser(token);
          if (!jwtErr && jwtUser?.user?.id) {
            return jwtUser.user.id;
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts authenticated user details (id, email, isDemo) from the request session.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser(request?: Request): Promise<{ id: string; email: string; isDemo: boolean } | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { id: user.id, email: user.email || '', isDemo: false };
    }

    if (request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) {
          const serviceClient = createServiceClient();
          const { data: jwtUser, error: jwtErr } = await serviceClient.auth.getUser(token);
          if (!jwtErr && jwtUser?.user) {
            return { id: jwtUser.user.id, email: jwtUser.user.email || '', isDemo: false };
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

