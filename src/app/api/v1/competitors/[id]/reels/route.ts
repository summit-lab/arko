/**
 * POST /api/v1/competitors/[id]/reels — Add a reel by Instagram URL
 * DELETE /api/v1/competitors/[id]/reels — Delete a reel by reelId in body
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

// ─── Extract shortcode from Instagram URL ───────────────────────────────────

function extractShortCode(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Formats: /reel/ABC123/, /reels/ABC123/, /p/ABC123/
    const parts = parsed.pathname.split('/').filter(Boolean);
    const reelIndex = parts.findIndex((p) => p === 'reel' || p === 'reels' || p === 'p');
    if (reelIndex >= 0 && parts[reelIndex + 1]) {
      return parts[reelIndex + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function extractUsername(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = parsed.pathname.split('/').filter(Boolean);
    // Username is the first path segment for profile URLs
    // For reel URLs like /reel/ABC123/ the username isn't in the URL
    // For /username/reel/ABC123/ the username is first
    if (parts.length >= 1 && parts[0] !== 'reel' && parts[0] !== 'reels' && parts[0] !== 'p') {
      return parts[0];
    }
    return null;
  } catch {
    return null;
  }
}

// ─── POST: Add reel by URL ──────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id: competitorId } = await params;
    const body = await request.json() as { url?: string };

    if (!body.url || typeof body.url !== 'string') {
      return api400('URL del reel es requerida');
    }

    const shortCode = extractShortCode(body.url);
    if (!shortCode) {
      return api400('URL de Instagram inválida. Formato esperado: instagram.com/reel/CÓDIGO');
    }

    const supabase = await createClient();

    // Verify competitor belongs to workspace and get their IG URL
    const { data: competitor } = await supabase
      .from('workspace_competitors')
      .select('id, name, ig_url')
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!competitor) {
      return api400('Competidor no encontrado');
    }

    // Validate username matches competitor (if we can extract it from the URL)
    const urlUsername = extractUsername(body.url);
    if (urlUsername && competitor.ig_url) {
      const competitorUsername = competitor.ig_url
        .replace(/\/$/, '')
        .split('/')
        .filter(Boolean)
        .pop()
        ?.toLowerCase();
      if (competitorUsername && urlUsername.toLowerCase() !== competitorUsername) {
        return api400(`Este reel no pertenece a ${competitor.name}. El reel es de @${urlUsername}, pero el competidor es @${competitorUsername}`);
      }
    }

    // Check if reel already exists
    const { data: existing } = await supabase
      .from('competitor_reels')
      .select('id')
      .eq('competitor_id', competitorId)
      .eq('short_code', shortCode)
      .maybeSingle();

    if (existing) {
      return api400('Este reel ya existe para este competidor');
    }

    // Insert the reel with minimal data (URL + shortcode)
    const permalink = `https://www.instagram.com/reel/${shortCode}/`;
    const { data: inserted, error: insertError } = await supabase
      .from('competitor_reels')
      .insert({
        competitor_id: competitorId,
        workspace_id: auth.workspaceId,
        short_code: shortCode,
        permalink,
        scraped_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      return api500('Error guardando el reel');
    }

    return apiSuccess({ reel_id: inserted.id, short_code: shortCode, permalink });
  } catch (error) {
    console.error('[competitors/reels] POST Error:', error);
    return api500('Error agregando reel');
  }
}

// ─── DELETE: Remove a reel ──────────────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id: competitorId } = await params;
    const body = await request.json() as { reelId?: string };

    if (!body.reelId) {
      return api400('reelId es requerido');
    }

    const supabase = await createClient();

    // Verify reel belongs to this competitor and workspace
    const { data: reel } = await supabase
      .from('competitor_reels')
      .select('id')
      .eq('id', body.reelId)
      .eq('competitor_id', competitorId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!reel) {
      return api400('Reel no encontrado');
    }

    // Delete (cascade will remove analysis too)
    const { error: deleteError } = await supabase
      .from('competitor_reels')
      .delete()
      .eq('id', body.reelId);

    if (deleteError) {
      return api500('Error eliminando reel');
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('[competitors/reels] DELETE Error:', error);
    return api500('Error eliminando reel');
  }
}
