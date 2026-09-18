import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase-server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    supabaseConfigured: isSupabaseConfigured(),
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    timestamp: new Date().toISOString(),
  });
}
