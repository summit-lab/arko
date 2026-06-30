import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { signStorageThumbs, pickThumb } from "@/lib/storage-thumbs";
import { VentasClient } from "./VentasClient";
import { getServerTier } from "@/lib/tier/server";
import { hasFeature, TRAP } from "@/lib/tier/config";
import { FeatureLock } from "@/components/common/FeatureLock";

export default async function VentasPage() {
  const tier = await getServerTier();
  if (!hasFeature(tier, "sales")) {
    return (
      <FeatureLock variant="page" preview="sales" title={TRAP.title} description={TRAP.description} ctaText={TRAP.ctaText} ctaHref={TRAP.ctaHref} />
    );
  }
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  let sales: Array<{
    id: string;
    source_type: string;
    source_label: string | null;
    amount_total: number;
    amount_collected: number;
    payment_type: string;
    payment_status: string;
    sale_date: string;
    payment_method: string | null;
    notes: string | null;
    client_name: string | null;
    reel_id: string | null;
    reels: { id: string; caption: string | null; thumbnail_url: string | null; permalink: string | null } | null;
    installments: Array<{ due_date: string; paid_at: string | null; amount: number }>;
  }> = [];

  let reelsForPicker: Array<{ id: string; caption: string | null; thumbnail_url: string | null; published_at: string | null }> = [];
  let storiesForPicker: Array<{ id: string; published_at: string; total_impressions: number; total_reach: number; slide_count: number; first_thumbnail: string | null }> = [];

  if (workspaceId) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [salesResult, reelsResult, storiesResult] = await Promise.all([
      supabase
        .from("sales")
        .select(`
          id, source_type, source_label, amount_total, amount_collected,
          payment_type, payment_status, sale_date, payment_method, notes,
          client_name, reel_id,
          reels (id, caption, thumbnail_url, media_storage_path, permalink),
          sale_installments (due_date, paid_at, amount)
        `)
        .eq("workspace_id", workspaceId)
        .order("sale_date", { ascending: false })
        .limit(200),
      // Pickers de Nueva Venta: traer TODOS los reels y stories de los últimos
      // 90 días. El UI tiene scroll + search, así que mostrar todos es seguro.
      // Cap alto (500) como safety net contra cuentas muy activas; Supabase
      // impone su propio hard cap por defecto (1000) si lo pedimos sin .limit().
      supabase
        .from("reels")
        .select("id, caption, thumbnail_url, media_storage_path, published_at")
        .eq("workspace_id", workspaceId)
        .gte("published_at", ninetyDaysAgo)
        .order("published_at", { ascending: false })
        .limit(500),
      supabase
        .from("ig_story_sequences")
        .select(`
          id, published_at, total_impressions, total_reach,
          ig_story_slides (thumbnail_url, media_storage_path, slide_index)
        `)
        .eq("workspace_id", workspaceId)
        .gte("published_at", ninetyDaysAgo)
        .order("published_at", { ascending: false })
        .limit(500),
    ]);

    // ── Storage-first (mismo patrón que /instagram y la home) ──
    // Las URLs crudas de scontent expiran en horas/días → miniaturas rotas en
    // la tabla, Top contenido y los pickers de Nueva Venta. Preferimos el
    // re-host estable (reel-media / story-media), firmado en UN batch por
    // bucket, los dos buckets en paralelo. Fallback a la URL cruda si el media
    // aún no se re-hosteó.
    type ReelEmbed = { id: string; caption: string | null; thumbnail_url: string | null; media_storage_path: string | null; permalink: string | null };
    const reelPaths: Array<string | null> = [];
    for (const s of (salesResult.data ?? []) as Array<{ reels: ReelEmbed | ReelEmbed[] | null }>) {
      const r = Array.isArray(s.reels) ? (s.reels[0] ?? null) : s.reels;
      reelPaths.push(r?.media_storage_path ?? null);
    }
    for (const r of (reelsResult.data ?? []) as Array<{ media_storage_path: string | null }>) {
      reelPaths.push(r.media_storage_path);
    }
    const storyPaths: Array<string | null> = [];
    for (const seq of (storiesResult.data ?? []) as Array<{ ig_story_slides: Array<{ media_storage_path: string | null }> | null }>) {
      for (const sl of seq.ig_story_slides ?? []) storyPaths.push(sl.media_storage_path);
    }
    const [reelSigned, storySigned] = await Promise.all([
      signStorageThumbs(supabase, "reel-media", reelPaths),
      signStorageThumbs(supabase, "story-media", storyPaths),
    ]);

    if (salesResult.data) {
      sales = salesResult.data.map((s) => {
        const r = (Array.isArray(s.reels) ? (s.reels[0] ?? null) : s.reels) as ReelEmbed | null;
        return {
          ...s,
          reels: r
            ? { id: r.id, caption: r.caption, thumbnail_url: pickThumb(reelSigned, r.media_storage_path, r.thumbnail_url), permalink: r.permalink }
            : null,
          installments: Array.isArray(s.sale_installments) ? s.sale_installments : [],
        };
      }) as typeof sales;
    }
    if (reelsResult.data) {
      reelsForPicker = (reelsResult.data as Array<{
        id: string; caption: string | null; thumbnail_url: string | null;
        media_storage_path: string | null; published_at: string | null;
      }>).map((r) => ({
        id: r.id,
        caption: r.caption,
        thumbnail_url: pickThumb(reelSigned, r.media_storage_path, r.thumbnail_url),
        published_at: r.published_at,
      }));
    }
    if (storiesResult.data) {
      storiesForPicker = (storiesResult.data as Array<{
        id: string; published_at: string; total_impressions: number; total_reach: number;
        ig_story_slides: Array<{ thumbnail_url: string | null; media_storage_path: string | null; slide_index: number }>;
      }>).map((seq) => {
        const slides = Array.isArray(seq.ig_story_slides) ? seq.ig_story_slides : [];
        const first = [...slides].sort((a, b) => a.slide_index - b.slide_index)[0];
        return {
          id: seq.id,
          published_at: seq.published_at,
          total_impressions: seq.total_impressions,
          total_reach: seq.total_reach,
          slide_count: slides.length,
          first_thumbnail: pickThumb(storySigned, first?.media_storage_path, first?.thumbnail_url),
        };
      });
    }
  }

  return <VentasClient initialSales={sales} reelsForPicker={reelsForPicker} storiesForPicker={storiesForPicker} />;
}
