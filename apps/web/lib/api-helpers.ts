// ==============================================================================
// iLock API Helpers & Standardized Responses
// ==============================================================================

import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createServerClient } from './supabase-server';
import { DEMO_USER_ID } from './demo-store';

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
 * Extracts authenticated user ID from the request session.
 * In Demo Mode or when Supabase is not configured, safely defaults to the DEMO_USER_ID.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    // Development Demo Mode fallback
    return DEMO_USER_ID;
  }

  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return DEMO_USER_ID;
    }

    return user.id;
  } catch (err) {
    return DEMO_USER_ID;
  }
}
