import { createBrowserClient } from '@supabase/ssr';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s+/g, '').trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s+/g, '').trim();
  return Boolean(
    url &&
    anon &&
    !url.includes('your-project-id') &&
    !url.includes('demo-placeholder') &&
    url.startsWith('https://')
  );
}

export function createClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo-placeholder.supabase.co').replace(/\s+/g, '').trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key').replace(/\s+/g, '').trim();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

