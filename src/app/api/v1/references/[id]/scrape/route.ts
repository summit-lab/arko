/**
 * POST /api/v1/references/[id]/scrape
 * Scrapes the IG profile + recent reels for a reference brand via Apify.
 * Stores result in workspace_references.scraped_data + scraped_reels.
 * Uploads thumbnails to competitor-assets bucket so they never expire.
 */

export const maxDuration = 300;

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { getApifyToken } from '@/lib/env';

const APIFY_BASE = 'https://api.apify.com/v2/acts';
const PROFILE_ACTOR = 'apify~instagram-profile-scraper';
const REEL_ACTOR = 'apify~instagram-reel-scraper';
const BUCKET = 'competitor-assets';
const MAX_REELS = 12;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveToken(): string | null {
  const raw = getApifyToken()?.trim();
  if (!raw) return null;
  const unquoted = raw.replace(/^['"]|['"]$/g, '');
  try {
    const t = new URL(unquoted).searchParams.get('token');
    if (t) return t;
  } catch { /* not a URL */ }
  return unquoted.match(/apify_api_[A-Za-z0-9]+/)?.[0] ?? unquoted;
}

function extractUsername(url: string): string {
  const clean = url.trim().replace(/\/$/, '');
  if (clean.startsWith('@')) return clean.slice(1);
  try {
    const parts = new URL(clean.startsWith('http') ? clean : `https://${clean}`)
      .pathname.split('/').filter(Boolean);
    return parts[0] ?? clean;
  } catch { return clean; }
}

function nullable(v: string | undefined | null): string | null {
  return v && v.trim().length > 0 ? v.trim() : null;
}

async function uploadImage(sourceUrl: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const admin = createAdminClient();
    const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
    if (error) { console.warn('[ref-scraper] upload error:', error.message); return null; }
    return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch { return null; }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const token = resolveToken();
    if (!token) return api400('APIFY_API_TOKEN no configurado');

    const { id } = await params;
    const supabase = await createClient();

    // Load reference
    const { data: ref } = await supabase
      .from('workspace_references')
      .select('id, brand_name, brand_url')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!ref) return api400('Referencia no encontrada');
    if (!ref.brand_url) return api400('Esta referencia no tiene URL de Instagram configurada');

    const username = extractUsername(ref.brand_url);

    // ── Scrape profile + reels in parallel ──
    const [profileRes, reelsRes] = await Promise.allSettled([
      fetch(`${APIFY_BASE}/${PROFILE_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username], resultsLimit: 1 }),
        cache: 'no-store',
        signal: AbortSignal.timeout(45000),
      }),
      fetch(`${APIFY_BASE}/${REEL_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: [`https://www.instagram.com/${username}/reels/`],
          resultsLimit: MAX_REELS,
          includeTranscript: false,
          includeSharesCount: false,
          includeDownloadedVideo: false,
          skipPinnedPosts: true,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(120000),
      }),
    ]);

    // ── Parse profile ──
    type ApifyProfile = {
      username?: string; fullName?: string; biography?: string;
      followersCount?: number; postsCount?: number; profilePicUrl?: string;
      isVerified?: boolean; isBusinessAccount?: boolean; businessCategoryName?: string;
    };

    let scraped_data: Record<string, unknown> | null = null;
    if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
      const items = await profileRes.value.json() as ApifyProfile[];
      const p = items[0];
      if (p) {
        // Upload profile pic
        let picUrl = nullable(p.profilePicUrl);
        if (picUrl) {
          const stored = await uploadImage(picUrl, `references/${auth.workspaceId}/${id}/profile.jpg`);
          if (stored) picUrl = stored;
        }
        scraped_data = {
          ig_username:       p.username ?? username,
          ig_full_name:      nullable(p.fullName),
          ig_bio:            nullable(p.biography),
          ig_follower_count: p.followersCount ?? null,
          ig_post_count:     p.postsCount ?? null,
          ig_profile_pic_url: picUrl,
          ig_is_verified:    p.isVerified ?? false,
          ig_is_business:    p.isBusinessAccount ?? false,
          ig_business_category: nullable(p.businessCategoryName),
        };
      }
    }

    // ── Parse reels ──
    type ApifyReel = {
      shortCode?: string; url?: string; caption?: string;
      likesCount?: number; commentsCount?: number;
      videoViewCount?: number; videoPlayCount?: number;
      videoDuration?: number; timestamp?: string; displayUrl?: string;
    };

    let scraped_reels: unknown[] = [];
    if (reelsRes.status === 'fulfilled' && reelsRes.value.ok) {
      const items = await reelsRes.value.json() as ApifyReel[];

      // Upload thumbnails in parallel
      scraped_reels = await Promise.all(
        items.slice(0, MAX_REELS).map(async (r, i) => {
          let thumbUrl = nullable(r.displayUrl);
          if (thumbUrl) {
            const key = r.shortCode ?? `reel-${i}`;
            const stored = await uploadImage(thumbUrl, `references/${auth.workspaceId}/${id}/reels/${key}.jpg`);
            if (stored) thumbUrl = stored;
          }
          return {
            short_code:   nullable(r.shortCode),
            permalink:    nullable(r.url),
            caption:      nullable(r.caption),
            likes_count:  r.likesCount ?? null,
            comments_count: r.commentsCount ?? null,
            views_count:  r.videoViewCount ?? r.videoPlayCount ?? null,
            duration_seconds: r.videoDuration ?? null,
            published_at: r.timestamp ?? null,
            thumbnail_url: thumbUrl,
          };
        })
      );
    }

    // ── Persist ──
    await supabase
      .from('workspace_references')
      .update({
        scraped_data,
        scraped_reels,
        last_scraped_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId);

    return apiSuccess({ scraped_data, scraped_reels, reels_found: scraped_reels.length });
  } catch (err) {
    console.error('[references/scrape]', err);
    return api500('Error scrapeando referencia');
  }
}
