import { jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServerClient } from '@/lib/supabase-server';

export async function POST() {
  try {
    if (isSupabaseConfigured()) {
      const serverClient = createServerClient();
      await serverClient.auth.signOut();
    }
    return jsonResponse({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    return jsonResponse({ success: true, message: 'Logged out' });
  }
}
