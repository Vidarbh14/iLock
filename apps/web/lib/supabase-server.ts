import { createServerClient as createSsrServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s+/g, '').trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s+/g, '').trim();
  return Boolean(url && anon && !url.includes('your-project-id') && !url.includes('demo-placeholder'));
}

export function createServerClient() {
  const cookieStore = cookies();
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo-placeholder.supabase.co').replace(/\s+/g, '').trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key').replace(/\s+/g, '').trim();

  return createSsrServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Handled in server components
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Handled in server components
        }
      },
    },
  });
}

/**
 * Privileged client using the SUPABASE_SERVICE_ROLE_KEY.
 * STRICTLY for server-side API routes handling agent dispatch and audit logging.
 */
export function createServiceClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo-placeholder.supabase.co').replace(/\s+/g, '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-service-key').replace(/\s+/g, '').trim();

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
