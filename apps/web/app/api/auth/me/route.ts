import { jsonResponse } from '@/lib/api-helpers';
import { getAuthenticatedUser } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return jsonResponse({ user: null });
  }

  return jsonResponse({
    user: {
      id: user.id,
      email: user.email,
      isDemo: user.isDemo,
      role: 'owner',
    },
  });
}
