/**
 * GET    /api/v1/onboarding/adn — Load progress + data
 * PATCH  /api/v1/onboarding/adn — Update individual ADN fields from the docs panel
 * POST   /api/v1/onboarding/adn — Bulk save competitors or references
 * DELETE /api/v1/onboarding/adn — Delete a competitor or reference by id
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { getAdnProgress, getAdnData } from '@/services/adn-progress.service';
import { invalidateWorkspaceCache } from '@/services/arko-ai-context';

const ALLOWED_TABLES = ['workspace_profile', 'workspace_market', 'workspace_brand'] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

function isAllowedTable(table: string): table is AllowedTable {
  return (ALLOWED_TABLES as readonly string[]).includes(table);
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { table, data } = body;

    if (!table || !data || typeof data !== 'object') {
      return api400('table and data are required');
    }

    if (!isAllowedTable(table)) {
      return api400(`Table "${table}" is not editable via this endpoint`);
    }

    // Filter to only string values, prevent injection
    const cleanData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        cleanData[key] = value;
      }
    }

    if (Object.keys(cleanData).length === 0) {
      return api400('No valid fields to update');
    }

    const supabase = await createClient();

    await supabase
      .from(table)
      .upsert(
        { workspace_id: auth.workspaceId, ...cleanData },
        { onConflict: 'workspace_id' }
      );

    // Invalidate Arko AI cache so next chat uses fresh ADN
    invalidateWorkspaceCache(auth.workspaceId);

    // Return updated progress + data
    const [progress, adnData] = await Promise.all([
      getAdnProgress(supabase, auth.workspaceId),
      getAdnData(supabase, auth.workspaceId),
    ]);

    return apiSuccess({ progress, data: adnData });
  } catch (err) {
    console.error('[onboarding/adn] PATCH error:', err);
    return api500();
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const [progress, adnData] = await Promise.all([
      getAdnProgress(supabase, auth.workspaceId),
      getAdnData(supabase, auth.workspaceId),
    ]);

    return apiSuccess({ progress, data: adnData });
  } catch (err) {
    console.error('[onboarding/adn] GET error:', err);
    return api500();
  }
}

// ─── POST: Bulk save competitors ─────────────────────────────────────────────

interface CompetitorInput {
  name: string;
  ig_url?: string;
  likes_brand?: string;
  likes_content?: string;
}

function buildWhyBetter(c: CompetitorInput): string | null {
  const brand = typeof c.likes_brand === 'string' ? c.likes_brand.trim() : '';
  const content = typeof c.likes_content === 'string' ? c.likes_content.trim() : '';
  if (!brand && !content) return null;
  const parts: string[] = [];
  if (brand) parts.push(`[MARCA] ${brand}`);
  if (content) parts.push(`[CONTENIDO] ${content}`);
  return parts.join('\n');
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { competitors } = body;

    if (!Array.isArray(competitors) || competitors.length === 0) {
      return api400('competitors array is required');
    }

    const supabase = await createClient();

    // Delete existing competitors for this workspace (replace all)
    await supabase
      .from('workspace_competitors')
      .delete()
      .eq('workspace_id', auth.workspaceId);

    // Insert new ones
    const rows = (competitors as CompetitorInput[])
      .filter((c) => c.name && typeof c.name === 'string' && c.name.trim().length > 0)
      .map((c) => ({
        workspace_id: auth.workspaceId,
        name: c.name.trim(),
        ig_url: typeof c.ig_url === 'string' ? c.ig_url.trim() || null : null,
        why_better: buildWhyBetter(c),
      }));

    if (rows.length > 0) {
      await supabase.from('workspace_competitors').insert(rows);
    }

    // Invalidate Arko AI cache so next chat uses fresh ADN
    invalidateWorkspaceCache(auth.workspaceId);

    // Return updated progress + data
    const [progress, adnData] = await Promise.all([
      getAdnProgress(supabase, auth.workspaceId),
      getAdnData(supabase, auth.workspaceId),
    ]);

    return apiSuccess({ progress, data: adnData });
  } catch (err) {
    console.error('[onboarding/adn] POST error:', err);
    return api500();
  }
}

// ─── DELETE: Remove a competitor by id ───────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return api400('id is required');
    }

    const supabase = await createClient();

    await supabase
      .from('workspace_competitors')
      .delete()
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId);

    // Invalidate Arko AI cache so next chat uses fresh ADN
    invalidateWorkspaceCache(auth.workspaceId);

    const [progress, adnData] = await Promise.all([
      getAdnProgress(supabase, auth.workspaceId),
      getAdnData(supabase, auth.workspaceId),
    ]);

    return apiSuccess({ progress, data: adnData });
  } catch (err) {
    console.error('[onboarding/adn] DELETE error:', err);
    return api500();
  }
}
