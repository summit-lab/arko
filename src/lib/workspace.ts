import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth-claims';

/**
 * Get workspace ID from cookie (fast) or fallback to DB query.
 * The middleware caches workspace_id in a cookie to avoid querying on every page.
 */
export async function getWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cachedWorkspaceId = cookieStore.get('arko_workspace_id')?.value;
  
  if (cachedWorkspaceId) {
    return cachedWorkspaceId;
  }

  // Fallback: query from DB (this should rarely happen after first load)
  const supabase = await createClient();
  const user = await getAuthUser(supabase); // getClaims (JWT local) + fallback getUser

  if (!user) return null;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .single();

  return workspace?.id ?? null;
}
