import { jsonResponse } from '@/lib/api-helpers';
import { getAuthenticatedUser } from '@/lib/api-helpers';

export async function GET() {
  const user = await getAuthenticatedUser();
  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      isDemo: user.isDemo,
      role: user.isDemo ? 'demo_owner' : 'primary_owner',
    },
  });
}
