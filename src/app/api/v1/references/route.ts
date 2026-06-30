/**
 * GET  /api/v1/references  — Lista referencias del workspace
 * POST /api/v1/references  — Agrega una nueva referencia
 */

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workspace_references')
      .select('id, brand_name, brand_url, what_they_like, created_at, scraped_data, scraped_reels, last_scraped_at')
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: true });

    if (error) return api500('Error cargando referencias');

    return apiSuccess({ references: data ?? [] });
  } catch {
    return api500('Error cargando referencias');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const body = await request.json() as { brand_name?: string; brand_url?: string; what_they_like?: string };
    const brand_name = body.brand_name?.trim();

    if (!brand_name) return api400('El nombre de la marca es obligatorio');

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workspace_references')
      .insert({
        workspace_id: auth.workspaceId,
        brand_name,
        brand_url: body.brand_url?.trim() || null,
        what_they_like: body.what_they_like?.trim() || null,
      })
      .select('id, brand_name, brand_url, what_they_like, created_at')
      .single();

    if (error) return api500('Error guardando referencia');

    return apiSuccess({ reference: data }, 201);
  } catch {
    return api500('Error guardando referencia');
  }
}
