import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { Eye, Heart, Bookmark, MessageSquare, Target } from "lucide-react";
import Link from "next/link";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function Home() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) redirect("/onboarding");

  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    { data: latestInsight },
    { data: reelAggs },
    { data: demographics },
    { data: topReels },
    { data: metaConn },
    { data: goalsData },
  ] = await Promise.all([
    // Latest account insight (follower count, impressions, etc.)
    supabase
      .from("ig_account_insights")
      .select("follower_count, impressions, reach, profile_views, likes, comments, saves, shares, total_interactions, metric_date")
      .eq("workspace_id", workspaceId)
      .order("metric_date", { ascending: false })
      .limit(1)
      .single(),

    // Aggregated reel metrics from computed view
    supabase
      .from("reel_computed")
      .select("views_total, views_org, views_paid, likes_total, comments_total, saves_total, shares_total, retention_ratio")
      .eq("workspace_id", workspaceId),

    // Demographics (audience country)
    supabase
      .from("ig_account_demographics")
      .select("audience_country")
      .eq("workspace_id", workspaceId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single(),

    // Top 5 reels by views
    supabase
      .from("reels")
      .select("caption, permalink, thumbnail_url, media_product_type, reel_metrics(views_org, likes_total, saves_total, avg_watch_time_sec, duration_sec), reel_metrics_paid(views_paid)")
      .eq("workspace_id", workspaceId)
      .order("published_at", { ascending: false })
      .limit(50),

    // Meta connection status
    supabase
      .from("meta_connections")
      .select("ig_username, status")
      .eq("workspace_id", workspaceId)
      .single(),

    // Monthly goals
    (() => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      return supabase
        .from("workspace_goals")
        .select("metric, target_value")
        .eq("workspace_id", workspaceId)
        .eq("period_start", periodStart);
    })(),
  ]);

  // Aggregate reel totals
  const totalViews = reelAggs?.reduce((s, r) => s + (r.views_total || 0), 0) ?? 0;
  const totalLikes = reelAggs?.reduce((s, r) => s + (r.likes_total || 0), 0) ?? 0;
  const totalSaves = reelAggs?.reduce((s, r) => s + (r.saves_total || 0), 0) ?? 0;
  const totalComments = reelAggs?.reduce((s, r) => s + (r.comments_total || 0), 0) ?? 0;
  const totalShares = reelAggs?.reduce((s, r) => s + (r.shares_total || 0), 0) ?? 0;
  const totalReels = reelAggs?.length ?? 0;

  // Sort top reels by total views
  const sortedReels = (topReels ?? [])
    .map((r) => {
      const org = Array.isArray(r.reel_metrics) ? r.reel_metrics[0] : r.reel_metrics;
      const paid = Array.isArray(r.reel_metrics_paid) ? r.reel_metrics_paid[0] : r.reel_metrics_paid;
      const viewsTotal = (org?.views_org ?? 0) + (paid?.views_paid ?? 0);
      const duration = org?.duration_sec ?? 1;
      const avgWatch = org?.avg_watch_time_sec ?? 0;
      const retention = duration > 0 ? Math.round((avgWatch / duration) * 100) : 0;
      return {
        caption: r.caption?.substring(0, 50) || "Sin título",
        type: r.media_product_type === "REELS" ? "Reel" : r.media_product_type === "IMAGE" ? "Post" : "Carousel",
        views: viewsTotal,
        likes: org?.likes_total ?? 0,
        saves: org?.saves_total ?? 0,
        retention,
        permalink: r.permalink,
        thumbnail: r.thumbnail_url,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  // Country data
  const countryRaw = (demographics?.audience_country ?? {}) as Record<string, number>;
  const countryTotal = Object.values(countryRaw).reduce((s, v) => s + v, 0) || 1;
  const countryFlags: Record<string, string> = {
    AR: "🇦🇷", ES: "🇪🇸", MX: "🇲🇽", CO: "🇨🇴", CL: "🇨🇱", PE: "🇵🇪",
    US: "🇺🇸", UY: "🇺🇾", EC: "🇪🇨", BR: "🇧🇷", VE: "🇻🇪", BO: "🇧🇴",
  };
  const countryNames: Record<string, string> = {
    AR: "Argentina", ES: "España", MX: "México", CO: "Colombia", CL: "Chile",
    PE: "Perú", US: "Estados Unidos", UY: "Uruguay", EC: "Ecuador", BR: "Brasil",
    VE: "Venezuela", BO: "Bolivia",
  };
  const topCountries = Object.entries(countryRaw)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([code, count]) => ({
      label: `${countryFlags[code] || "🌍"} ${countryNames[code] || code}`,
      pct: Math.round((count / countryTotal) * 100),
    }));

  // Account metrics
  const followers = latestInsight?.follower_count ?? 0;
  const impressions = latestInsight?.impressions ?? 0;
  const reach = latestInsight?.reach ?? 0;
  const profileViews = latestInsight?.profile_views ?? 0;

  // Connection status
  const isConnected = metaConn?.status === "active";
  const igUsername = metaConn?.ig_username;

  // Goals with current progress
  const METRIC_LABELS: Record<string, string> = {
    views: "Views totales", followers: "Seguidores", likes: "Likes",
    saves: "Guardados", reach: "Alcance", engagement_rate: "Engagement Rate",
  };
  const metricCurrentValues: Record<string, number> = {
    views: totalViews, followers, likes: totalLikes,
    saves: totalSaves, reach, engagement_rate: totalViews > 0 ? ((totalLikes + totalComments + totalSaves + totalShares) / totalViews) * 100 : 0,
  };
  const goals = (goalsData ?? []).map((g) => ({
    metric: g.metric as string,
    label: METRIC_LABELS[g.metric as string] || g.metric,
    target: Number(g.target_value),
    current: metricCurrentValues[g.metric as string] ?? 0,
  }));

  // Key metrics for cards
  const keyMetrics = [
    { label: "Total Views", value: fmt(totalViews), icon: Eye, color: "text-blue-400" },
    { label: "Guardados", value: fmt(totalSaves), icon: Bookmark, color: "text-amber-400" },
    { label: "Likes", value: fmt(totalLikes), icon: Heart, color: "text-rose-400" },
    { label: "Comentarios", value: fmt(totalComments), icon: MessageSquare, color: "text-emerald-400" },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Resumen global de tu marca personal.
          {isConnected && igUsername && (
            <span className="text-white/50 ml-2">@{igUsername}</span>
          )}
        </p>
      </div>

      {/* ROW 1: Account Overview + Key Metrics */}
      <div className="grid grid-cols-12 gap-6">
        {/* Account Overview */}
        <div className="col-span-5 glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-5">Resumen de Cuenta</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Seguidores</p>
              <p className="text-2xl font-bold text-white mt-1">{fmt(followers)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Impresiones</p>
              <p className="text-2xl font-bold text-white mt-1">{fmt(impressions)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Alcance</p>
              <p className="text-2xl font-bold text-white mt-1">{fmt(reach)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Visitas Perfil</p>
              <p className="text-2xl font-bold text-white mt-1">{fmt(profileViews)}</p>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Contenido</p>
              <p className="text-lg font-bold text-white mt-0.5">{totalReels} publicaciones</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Interacciones</p>
              <p className="text-lg font-bold text-white mt-0.5">{fmt(totalLikes + totalComments + totalSaves + totalShares)}</p>
            </div>
          </div>
        </div>

        {/* Audience by Country */}
        <div className="col-span-4 glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-5">Audiencia por País</h3>
          {topCountries.length > 0 ? (
            <div className="space-y-3">
              {topCountries.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-300">{c.label}</span>
                    <span className="text-xs font-medium text-zinc-400">{c.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Sin datos demográficos aún. Sincronizá tu cuenta de Instagram.</p>
          )}
        </div>

        {/* Key Numbers */}
        <div className="col-span-3 grid grid-rows-4 gap-3">
          {keyMetrics.map((m) => (
            <div key={m.label} className="glass-panel rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">{m.label}</p>
                <p className="text-lg font-bold text-white">{m.value}</p>
              </div>
              <m.icon className={`h-5 w-5 ${m.color} opacity-60`} />
            </div>
          ))}
        </div>
      </div>

      {/* ROW 2: Monthly Goals */}
      {goals.length > 0 ? (
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-zinc-300">Metas del Mes</h3>
            </div>
            <Link
              href="/customer-voice"
              className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
            >
              Configurar →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((g) => {
              const pct = g.metric === "engagement_rate"
                ? Math.min(100, Math.round((g.current / g.target) * 100))
                : Math.min(100, Math.round((g.current / g.target) * 100));
              const isComplete = pct >= 100;
              return (
                <div key={g.metric} className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">{g.label}</span>
                    <span className={`text-[10px] font-medium ${isComplete ? "text-emerald-400" : "text-zinc-500"}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-lg font-bold text-white">
                      {g.metric === "engagement_rate" ? `${g.current.toFixed(1)}%` : fmt(g.current)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      / {g.metric === "engagement_rate" ? `${g.target}%` : fmt(g.target)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isComplete
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : "bg-gradient-to-r from-cyan-500 to-blue-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-zinc-500" />
              <p className="text-sm text-zinc-400">
                No tenés metas configuradas.
              </p>
            </div>
            <Link
              href="/customer-voice"
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Configurar metas →
            </Link>
          </div>
        </div>
      )}

      {/* ROW 3: Top Performing Content */}
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Top Performing Content</h3>
        {sortedReels.length > 0 ? (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 uppercase tracking-wider pb-2 border-b border-white/5">
              <div className="col-span-5">Título</div>
              <div className="col-span-1 text-center">Views</div>
              <div className="col-span-1 text-center">Saves</div>
              <div className="col-span-1 text-center">Likes</div>
              <div className="col-span-2 text-center">Retención</div>
              <div className="col-span-2 text-center">Tipo</div>
            </div>
            {sortedReels.map((c, i) => (
              <a
                key={i}
                href={c.permalink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-12 gap-2 items-center py-3 rounded-lg hover:bg-white/5 transition-colors px-1 cursor-pointer group"
              >
                <div className="col-span-5 flex items-center gap-3">
                  {c.thumbnail ? (
                    <img
                      src={c.thumbnail}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 shrink-0" />
                  )}
                  <span className="text-sm text-zinc-200 group-hover:text-white truncate transition-colors">
                    {c.caption}
                  </span>
                </div>
                <div className="col-span-1 text-center text-xs font-medium text-zinc-300">{fmt(c.views)}</div>
                <div className="col-span-1 text-center text-xs text-zinc-400">{fmt(c.saves)}</div>
                <div className="col-span-1 text-center text-xs text-zinc-400">{fmt(c.likes)}</div>
                <div className="col-span-2 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    c.retention >= 50
                      ? "text-emerald-400 bg-emerald-400/10"
                      : c.retention >= 30
                        ? "text-amber-400 bg-amber-400/10"
                        : "text-zinc-400 bg-white/5"
                  }`}>
                    {c.retention}%
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[10px] font-medium text-zinc-500 bg-white/5 px-2 py-1 rounded">{c.type}</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 py-4">No hay contenido aún. Conectá tu cuenta de Instagram y sincronizá.</p>
        )}
      </div>
    </div>
  );
}
