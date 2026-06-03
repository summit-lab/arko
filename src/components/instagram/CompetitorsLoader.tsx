import { createClient } from "@/lib/supabase/server";
import { CompetitorTab } from "./CompetitorTab";

/**
 * Server Component async que carga la data PESADA de competencia (embed de 3
 * niveles: competitor_reels x competitor_reel_analysis x follower_snapshots) FUERA
 * del critical path del page. Se renderiza dentro de un <Suspense> en la pagina, asi
 * la tab default (reels) pinta sin esperar esta query — la mas cara de la pantalla.
 * Los stats propios (myStats/myReels/myFollowerHistory) se derivan en el page de la
 * data rapida (reels + insights) y llegan por props ya calculados.
 */
export async function CompetitorsLoader({
  workspaceId,
  myStats,
  myReels,
  myFollowerHistory,
}: {
  workspaceId: string | null;
  myStats: { avgViews: number; followers: number; avgLikes: number; avgComments: number };
  myReels: Array<{ published_at: string | null; views_total: number }>;
  myFollowerHistory: Array<{ date: string; followers: number }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialCompetitors: any[] = [];

  if (workspaceId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workspace_competitors")
      .select(`
        id, name, ig_url, why_better, scraped_data, last_scraped_at, analysis_status,
        competitor_reels (
          id, short_code, permalink, caption,
          likes_count, comments_count, views_count, shares_count,
          duration_seconds, published_at, thumbnail_url,
          hashtags, music_artist, music_name,
          competitor_reel_analysis (
            hook_text, hook_type, narrative_structure, content_type,
            cta_text, cta_type, topic_cluster, style_notes,
            strengths, weaknesses, ai_summary, model_used
          )
        ),
        competitor_follower_snapshots (
          snapshot_date, follower_count
        )
      `)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .order("published_at", { ascending: false, referencedTable: "competitor_reels" })
      // Alineado con MAX_REELS_PER_SCRAPE (50) del scraper. La UI pagina
      // de 20 en 20, asi que con 50 cubrimos 2-3 paginas por competidor.
      .limit(50, { referencedTable: "competitor_reels" })
      .order("snapshot_date", { ascending: false, referencedTable: "competitor_follower_snapshots" })
      .limit(90, { referencedTable: "competitor_follower_snapshots" });
    initialCompetitors = data ?? [];
  }

  return (
    <CompetitorTab
      workspaceId={workspaceId}
      initialCompetitors={initialCompetitors}
      myStats={myStats}
      myReels={myReels}
      myFollowerHistory={myFollowerHistory}
    />
  );
}
