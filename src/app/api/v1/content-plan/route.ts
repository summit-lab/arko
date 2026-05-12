/**
 * GET    /api/v1/content-plan  — Lista items del workspace
 * POST   /api/v1/content-plan  — Crea un nuevo item
 * PATCH  /api/v1/content-plan  — Actualiza un item (id en body)
 * DELETE /api/v1/content-plan  — Elimina un item (?id= en query)
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import type { ContentType, ContentStatus, ContentPlatform, ContentMetrics } from '@/types/content-plan';

const VALID_STATUSES: ContentStatus[] = [
  'idea', 'script', 'needs_recording', 'recorded',
  'needs_editing', 'editing', 'scheduled', 'published',
];
const VALID_TYPES: ContentType[]     = ['reel', 'carousel', 'story'];
const VALID_PLATFORMS: ContentPlatform[] = ['instagram', 'tiktok', 'youtube'];

const BASE_SELECT = 'id, planned_date, title, description, platform, content_type, status, created_at, updated_at';
const FULL_SELECT = `${BASE_SELECT}, script, source_type, source_ref, metrics`;

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const full = await supabase
      .from('content_plan')
      .select(FULL_SELECT)
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: false });

    if (!full.error) return apiSuccess({ items: full.data ?? [] });

    const base = await supabase
      .from('content_plan')
      .select(BASE_SELECT)
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: false });

    if (base.error) return api500('Error cargando items de contenido');
    return apiSuccess({ items: base.data ?? [] });
  } catch {
    return api500('Error cargando items de contenido');
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json() as {
      title?: string;
      content_type?: string;
      status?: string;
      platform?: string;
      planned_date?: string | null;
      description?: string | null;
      script?: string | null;
      source_type?: string;
      source_ref?: string | null;
    };

    const title = body.title?.trim();
    if (!title) return api400('El título es obligatorio');

    const content_type = (body.content_type ?? 'reel') as ContentType;
    if (!VALID_TYPES.includes(content_type)) return api400('Tipo de contenido inválido');

    const status = (body.status ?? 'idea') as ContentStatus;
    if (!VALID_STATUSES.includes(status)) return api400('Estado inválido');

    const platform = (body.platform ?? 'instagram') as ContentPlatform;
    if (!VALID_PLATFORMS.includes(platform)) return api400('Plataforma inválida');

    // planned_date era NOT NULL en schema original; defaulteamos a hoy como fallback
    const planned_date = body.planned_date ?? new Date().toISOString().slice(0, 10);

    const supabase = createServiceClient();

    // Paso 1: Insert base (siempre funciona, con o sin migración 100)
    const { data: inserted, error: insertError } = await supabase
      .from('content_plan')
      .insert({
        workspace_id: auth.workspaceId,
        title,
        content_type,
        status,
        platform,
        planned_date,
        description: body.description?.trim() ?? null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      const msg = insertError?.message ?? 'sin respuesta';
      console.error('[content-plan POST] insert error:', msg);
      return api500(process.env.NODE_ENV === 'development' ? `Insert falló: ${msg}` : 'Error creando item');
    }

    // Paso 2: Update con campos de migración 100 (falla silenciosamente si no existen)
    const extras: Record<string, unknown> = { source_type: body.source_type ?? 'manual' };
    if (body.script   !== undefined) extras.script    = body.script?.trim()  ?? null;
    if (body.source_ref !== undefined) extras.source_ref = body.source_ref ?? null;
    await supabase.from('content_plan').update(extras).eq('id', inserted.id);
    // Ignoramos el error intencionalmente — las columnas pueden no existir aún

    // Paso 3: Devolver el item completo
    const { data: fullItem } = await supabase
      .from('content_plan').select(FULL_SELECT).eq('id', inserted.id).single();
    if (fullItem) return apiSuccess({ item: fullItem }, 201);

    const { data: baseItem } = await supabase
      .from('content_plan').select(BASE_SELECT).eq('id', inserted.id).single();
    if (!baseItem) return api500('Error recuperando item creado');
    return apiSuccess({ item: baseItem }, 201);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[content-plan POST] catch:', msg);
    return api500(process.env.NODE_ENV === 'development' ? `Error inesperado: ${msg}` : 'Error creando item');
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json() as {
      id?: string;
      title?: string;
      content_type?: string;
      status?: string;
      platform?: string;
      planned_date?: string | null;
      description?: string | null;
      script?: string | null;
      metrics?: ContentMetrics | null;
    };

    if (!body.id) return api400('El id es obligatorio');

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) return api400('El título no puede estar vacío');
      updates.title = t;
    }
    if (body.content_type !== undefined) {
      if (!VALID_TYPES.includes(body.content_type as ContentType)) return api400('Tipo inválido');
      updates.content_type = body.content_type;
    }
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as ContentStatus)) return api400('Estado inválido');
      updates.status = body.status;
    }
    if (body.platform !== undefined) {
      if (!VALID_PLATFORMS.includes(body.platform as ContentPlatform)) return api400('Plataforma inválida');
      updates.platform = body.platform;
    }
    if ('planned_date' in body) updates.planned_date = body.planned_date ?? null;
    if ('description'  in body) updates.description  = body.description?.trim()  ?? null;
    if ('script'       in body) updates.script        = body.script?.trim()        ?? null;
    if ('metrics'      in body) updates.metrics       = body.metrics               ?? null;

    if (Object.keys(updates).length === 0) return api400('Nada que actualizar');

    const supabase = createServiceClient();

    // Intentar con FULL_SELECT; si falla por columnas nuevas, reintentar con BASE
    const fullResult = await supabase
      .from('content_plan')
      .update(updates)
      .eq('id', body.id)
      .eq('workspace_id', auth.workspaceId)
      .select(FULL_SELECT)
      .single();

    if (!fullResult.error) {
      return fullResult.data ? apiSuccess({ item: fullResult.data }) : api400('Item no encontrado');
    }

    // Fallback: quitar campos que requieren migración y reintentar
    const safeUpdates = { ...updates };
    delete safeUpdates.script;
    delete safeUpdates.metrics;
    if (Object.keys(safeUpdates).length === 0) return api400('Nada que actualizar');

    const baseResult = await supabase
      .from('content_plan')
      .update(safeUpdates)
      .eq('id', body.id)
      .eq('workspace_id', auth.workspaceId)
      .select(BASE_SELECT)
      .single();

    if (baseResult.error) return api500('Error actualizando item');
    if (!baseResult.data)  return api400('Item no encontrado');
    return apiSuccess({ item: baseResult.data });

  } catch {
    return api500('Error actualizando item');
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    if (!id) return api400('El id es obligatorio');

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('content_plan')
      .delete()
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId);

    if (error) return api500('Error eliminando item');
    return apiSuccess({ deleted: true });
  } catch {
    return api500('Error eliminando item');
  }
}
