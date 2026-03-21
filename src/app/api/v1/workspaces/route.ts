/**
 * /api/v1/workspaces
 * GET  — List user's workspaces
 * POST — Create a new workspace
 */

import { createClient } from '@/lib/supabase/server';
import { apiSuccess, api400, api401, api500 } from '@/lib/api/response';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return api401();

    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[workspaces] List error:', error);
      return api500();
    }

    return apiSuccess(data);
  } catch {
    return api500();
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return api401();

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return api400('name is required (min 2 characters)');
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 6);

    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        slug,
      })
      .select()
      .single();

    if (error) {
      console.error('[workspaces] Create error:', error);
      return api500();
    }

    return apiSuccess(data, 201);
  } catch {
    return api500();
  }
}
