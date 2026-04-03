import { Eye, Heart, Bookmark, MessageSquare, Instagram, Youtube, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { ContentCalendar } from "@/components/dashboard/ContentCalendar";
import { MetasDonut } from "@/components/dashboard/MetasDonut";
import { CountUp } from "@/components/ui/CountUp";

// ─── Helpers ───

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toString();
}

function pctChange(current: number, previous: number): { text: string; up: boolean } {
  if (previous === 0) return current > 0 ? { text: "+100%", up: true } : { text: "—", up: true };
  const change = ((current - previous) / previous) * 100;
  return {
    text: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    up: change >= 0,
  };
}

const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  US: { name: "Estados Unidos", flag: "🇺🇸" },
  ES: { name: "España", flag: "🇪🇸" },
  MX: { name: "México", flag: "🇲🇽" },
  AR: { name: "Argentina", flag: "🇦🇷" },
  CO: { name: "Colombia", flag: "🇨🇴" },
  CL: { name: "Chile", flag: "🇨🇱" },
  UY: { name: "Uruguay", flag: "🇺🇾" },
  PE: { name: "Perú", flag: "🇵🇪" },
  BR: { name: "Brasil", flag: "🇧🇷" },
  EC: { name: "Ecuador", flag: "🇪🇨" },
  VE: { name: "Venezuela", flag: "🇻🇪" },
  BO: { name: "Bolivia", flag: "🇧🇴" },
  PY: { name: "Paraguay", flag: "🇵🇾" },
  CR: { name: "Costa Rica", flag: "🇨🇷" },
  PA: { name: "Panamá", flag: "🇵🇦" },
  DO: { name: "Rep. Dominicana", flag: "🇩🇴" },
  GT: { name: "Guatemala", flag: "🇬🇹" },
  HN: { name: "Honduras", flag: "🇭🇳" },
  SV: { name: "El Salvador", flag: "🇸🇻" },
  NI: { name: "Nicaragua", flag: "🇳🇮" },
  GB: { name: "Reino Unido", flag: "🇬🇧" },
  DE: { name: "Alemania", flag: "🇩🇪" },
  FR: { name: "Francia", flag: "🇫🇷" },
  IT: { name: "Italia", flag: "🇮🇹" },
  PT: { name: "Portugal", flag: "🇵🇹" },
  CA: { name: "Canadá", flag: "🇨🇦" },
};

// ─── Data Fetching ───

async function getDashboardData() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [
    insightsCurrent,
    insightsPrevious,
    insightsWeek,
    insightsMonthly,
    reelsData,
    demographics,
  ] = await Promise.all([
    // Query 1: Last 30 days insights
    supabase
      .from("ig_account_insights")
      .select("reach, impressions, total_interactions, likes, comments, shares, saves, follower_count, follows_count")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", thirtyDaysAgo)
      .lt("metric_date", today)
      .order("metric_date", { ascending: false })
      .limit(30),

    // Query 2: Previous 30 days insights (for % change)
    supabase
      .from("ig_account_insights")
      .select("reach, likes, comments, shares, saves")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", sixtyDaysAgo)
      .lt("metric_date", thirtyDaysAgo)
      .limit(30),

    // Query 3: Follower growth last 7 days (via followers_total diff or follower_count sum)
    supabase
      .from("ig_account_insights")
      .select("metric_date, follower_count, followers_total")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", sevenDaysAgo)
      .lt("metric_date", today)
      .order("metric_date", { ascending: true }),

    // Query 4: Last 30 days daily insights (for daily charts)
    supabase
      .from("ig_account_insights")
      .select("metric_date, reach, impressions, likes, saves, comments")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", thirtyDaysAgo)
      .lt("metric_date", today)
      .order("metric_date", { ascending: true })
      .limit(30),

    // Query 5: Reels with metrics (last 90 days, for top content + growth chart)
    supabase
      .from("reels")
      .select(`
        id, caption, permalink, published_at, media_type, reel_type, has_ads, sales_amount,
        reel_metrics (views_org, likes_total, comments_total, shares_total, saves_total),
        reel_metrics_paid (views_paid)
      `)
      .eq("workspace_id", workspaceId)
      .gte("published_at", ninetyDaysAgo)
      .order("published_at", { ascending: false })
      .limit(200),

    // Query 6: Demographics (latest)
    supabase
      .from("ig_account_demographics")
      .select("audience_country")
      .eq("workspace_id", workspaceId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ─── Log query errors ───
  if (insightsCurrent.error) console.error('[dashboard] insightsCurrent error:', insightsCurrent.error);
  if (insightsPrevious.error) console.error('[dashboard] insightsPrevious error:', insightsPrevious.error);
  if (insightsWeek.error) console.error('[dashboard] insightsWeek error:', insightsWeek.error);
  if (insightsMonthly.error) console.error('[dashboard] insightsMonthly error:', insightsMonthly.error);
  if (reelsData.error) console.error('[dashboard] reelsData error:', reelsData.error);
  if (demographics.error) console.error('[dashboard] demographics error:', demographics.error);

  // ─── Process insights data ───

  const current30d = (insightsCurrent.data ?? []).filter(
    (d) => (d.reach ?? 0) > 0 || (d.impressions ?? 0) > 0
  );
  const previous30d = insightsPrevious.data ?? [];

  const sumCurrent = {
    reach: current30d.reduce((s, r) => s + (r.reach || 0), 0),
    likes: current30d.reduce((s, r) => s + (r.likes || 0), 0),
    comments: current30d.reduce((s, r) => s + (r.comments || 0), 0),
    saves: current30d.reduce((s, r) => s + (r.saves || 0), 0),
    shares: current30d.reduce((s, r) => s + (r.shares || 0), 0),
    interactions: current30d.reduce((s, r) => s + (r.total_interactions || 0), 0),
  };

  const sumPrevious = {
    reach: previous30d.reduce((s, r) => s + (r.reach || 0), 0),
    likes: previous30d.reduce((s, r) => s + (r.likes || 0), 0),
    comments: previous30d.reduce((s, r) => s + (r.comments || 0), 0),
    saves: previous30d.reduce((s, r) => s + (r.saves || 0), 0),
    shares: previous30d.reduce((s, r) => s + (r.shares || 0), 0),
  };

  // Follower growth last 7 days: prefer followers_total diff, fallback to follower_count sum
  const weekFollowerRows = insightsWeek.data ?? [];
  const withFt = weekFollowerRows.filter((r) => (r.followers_total || 0) > 0);
  const firstFt = withFt[0]?.followers_total ?? 0;
  const lastFt = withFt[withFt.length - 1]?.followers_total ?? 0;
  const newFollowsWeek = lastFt > firstFt
    ? lastFt - firstFt
    : weekFollowerRows.reduce((s, r) => s + (r.follower_count || 0), 0);

  // ─── Process reels for views KPI + top content ───

  const reels = (reelsData.data ?? []).map((r) => {
    const metrics = Array.isArray(r.reel_metrics) ? r.reel_metrics[0] : r.reel_metrics;
    const paid = Array.isArray(r.reel_metrics_paid) ? r.reel_metrics_paid[0] : r.reel_metrics_paid;
    const viewsOrg = metrics?.views_org || 0;
    const viewsPaid = paid?.views_paid || 0;
    return {
      id: r.id,
      caption: r.caption,
      permalink: r.permalink,
      published_at: r.published_at,
      reel_type: r.reel_type,
      has_ads: r.has_ads,
      views_org: viewsOrg,
      views_paid: viewsPaid,
      views_total: viewsOrg + viewsPaid,
      likes: metrics?.likes_total || 0,
      saves: metrics?.saves_total || 0,
      comments: metrics?.comments_total || 0,
      shares: metrics?.shares_total || 0,
      sales_amount: r.sales_amount ?? null,
    };
  });

  const totalViews = reels.reduce((s, r) => s + r.views_total, 0);
  const totalSales = reels.reduce((s, r) => s + (r.sales_amount ?? 0), 0);

  // Views for previous period — reels published between 60 and 30 days ago don't exist in our query.
  // Use reach as proxy for "Total Views" KPI change since we have insights for both periods.
  const viewsChange = pctChange(sumCurrent.reach, sumPrevious.reach);

  // Top 4 reels by views
  const topContent = [...reels]
    .sort((a, b) => b.views_total - a.views_total)
    .slice(0, 4)
    .map((r) => {
      const engRate = r.views_total > 0
        ? ((r.likes + r.comments + r.saves + r.shares) / r.views_total) * 100
        : 0;
      return {
        title: r.caption?.slice(0, 60) || "Sin título",
        platform: r.has_ads ? "IG Reel (Ads)" : "IG Reel",
        views: formatCompact(r.views_total),
        saves: formatCompact(r.saves),
        likes: formatCompact(r.likes),
        engRate: engRate > 0 ? `${engRate.toFixed(0)}%` : "—",
      };
    });

  // Best reel
  const bestReelViews = reels.length > 0 ? Math.max(...reels.map((r) => r.views_total)) : 0;

  // Engagement rate 30d
  const engRate30d = sumCurrent.reach > 0
    ? (sumCurrent.interactions / sumCurrent.reach) * 100
    : 0;

  // ─── Daily chart data from ig_account_insights ───
  // Filter out days with zero metrics (incomplete sync data from current day)

  const dailyInsights = (insightsMonthly.data ?? []).filter(
    (d) => (d.impressions ?? 0) > 0 || (d.reach ?? 0) > 0
  );

  const growthData = dailyInsights.map((row) => {
    const d = new Date(row.metric_date);
    return {
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      reach: row.reach || 0,
      impressions: row.impressions || 0,
    };
  });

  const engagementData = dailyInsights.map((row) => {
    const d = new Date(row.metric_date);
    return {
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      likes: row.likes || 0,
      saves: row.saves || 0,
      comments: row.comments || 0,
    };
  });

  // ─── Countries ───

  const countryRaw: Record<string, number> = demographics.data?.audience_country ?? {};
  const countryTotal = Object.values(countryRaw).reduce((s, v) => s + v, 0);
  const countries = Object.entries(countryRaw)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([code, count]) => {
      const info = COUNTRY_MAP[code] || { name: code, flag: "🌍" };
      return {
        country: info.name,
        flag: info.flag,
        pct: countryTotal > 0 ? Math.round((count / countryTotal) * 100) : 0,
      };
    });

  // ─── KPIs ───

  const kpis = [
    {
      label: "Total Views",
      value: totalViews > 0 ? formatCompact(totalViews) : "—",
      change: viewsChange.text,
      up: viewsChange.up,
      icon: "eye" as const,
      color: "text-blue-400",
    },
    {
      label: "Guardados",
      value: sumCurrent.saves > 0 ? formatCompact(sumCurrent.saves) : "—",
      ...pctChange(sumCurrent.saves, sumPrevious.saves),
      icon: "bookmark" as const,
      color: "text-amber-400",
    },
    {
      label: "Likes",
      value: sumCurrent.likes > 0 ? formatCompact(sumCurrent.likes) : "—",
      ...pctChange(sumCurrent.likes, sumPrevious.likes),
      icon: "heart" as const,
      color: "text-rose-400",
    },
    {
      label: "Comentarios",
      value: sumCurrent.comments > 0 ? formatCompact(sumCurrent.comments) : "—",
      ...pctChange(sumCurrent.comments, sumPrevious.comments),
      icon: "message" as const,
      color: "text-emerald-400",
    },
  ];

  // ─── Quick Stats ───

  const quickStats = [
    { label: "Alcance Total", value: sumCurrent.reach > 0 ? formatCompact(sumCurrent.reach) : "—", sub: "últimos 30 días" },
    { label: "Tasa de Engagement", value: engRate30d > 0 ? `${engRate30d.toFixed(1)}%` : "—", sub: "interacciones / alcance" },
    { label: "Mejor Reel", value: bestReelViews > 0 ? formatCompact(bestReelViews) : "—", sub: "views" },
    { label: "Nuevos Follows", value: newFollowsWeek > 0 ? formatCompact(newFollowsWeek) : "—", sub: "últimos 7 días" },
    ...(totalSales > 0 ? [{ label: "Ventas Totales", value: `$${formatCompact(totalSales)}`, sub: "desde reels" }] : []),
  ];

  // Calendar reels (all, for this month) — include KPIs for display
  const calendarReels = reels.map((r) => ({
    id: r.id,
    published_at: r.published_at,
    caption: r.caption,
    has_ads: r.has_ads,
    reel_type: r.reel_type,
    views_total: r.views_total,
    likes: r.likes,
    saves: r.saves,
    comments: r.comments,
  }));

  // Top reels por ventas (para gráfico)
  const salesChartData = [...reels]
    .filter((r) => (r.sales_amount ?? 0) > 0)
    .sort((a, b) => (b.sales_amount ?? 0) - (a.sales_amount ?? 0))
    .slice(0, 8)
    .map((r) => ({
      caption: r.caption ? (r.caption.length > 22 ? r.caption.slice(0, 22) + "…" : r.caption) : "Sin caption",
      amount: r.sales_amount ?? 0,
      views: r.views_total,
    }));

  return { kpis, topContent, quickStats, countries, growthData, engagementData, salesChartData, calendarReels };
}

// ─── Icon mapping (can't pass components as serialized data) ───

const ICON_MAP = {
  eye: Eye,
  bookmark: Bookmark,
  heart: Heart,
  message: MessageSquare,
} as const;

// ─── Page ───

export default async function Home() {
  const data = await getDashboardData();

  const hasData = data !== null;
  const kpis = data?.kpis ?? [];
  const topContent = data?.topContent ?? [];
  const quickStats = data?.quickStats ?? [];
  // countries removed (Top Países panel eliminado)
  const growthData = data?.growthData ?? [];
  const engagementData = data?.engagementData ?? [];
  const salesChartData = data?.salesChartData ?? [];
  const calendarReels = data?.calendarReels ?? [];

  return (
    <div className="px-8 py-10">
      {/* Header */}
      <div className="animate-slide-up mb-10">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">Resumen global de tu marca personal.</p>
      </div>

      {/* Main 70/30 Layout */}
      <div className="flex gap-6">
        {/* ── LEFT: Main Content (70%) ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Hero KPIs */}
          <div className="grid grid-cols-4 gap-5">
            {kpis.map((m, i) => {
              const IconComp = ICON_MAP[m.icon];
              return (
                <div key={m.label} className={`glass-card px-6 py-5 animate-slide-up stagger-${i + 1}`}>
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <p className="stat-label">{m.label}</p>
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${m.color}`} style={{ background: "rgba(255,255,255,0.06)" }}>
                      <IconComp className="h-[18px] w-[18px]" />
                    </div>
                  </div>
                  <CountUp value={m.value} className="stat-number-xl relative z-10" />
                  <div className="flex items-center gap-1.5 mt-3 relative z-10">
                    {m.change !== "—" ? (
                      <>
                        {m.up ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                        )}
                        <span className={`text-[12px] font-medium ${m.up ? "text-emerald-400" : "text-red-400"}`}>{m.change}</span>
                        <span className="text-[11px] text-white/25 ml-1">vs prev</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-white/20">sin datos previos</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Row — Recharts */}
          <div className="animate-slide-up stagger-5">
            <DashboardCharts growthData={growthData} engagementData={engagementData} salesData={salesChartData} />
          </div>

          {/* Top Performing Content */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-light text-white tracking-wide">Top Performing Content</h3>
              <span className="text-[11px] text-white/30 font-medium uppercase tracking-[0.1em]">Últimos 90 días</span>
            </div>
            {topContent.length > 0 ? (
              <div className="space-y-1">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">Título</div>
                  <div className="col-span-2 text-right">Views</div>
                  <div className="col-span-1 text-right">Saves</div>
                  <div className="col-span-1 text-right">Likes</div>
                  <div className="col-span-1 text-center">Eng.</div>
                  <div className="col-span-2 text-center">Plataforma</div>
                </div>
                {topContent.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center py-3.5 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2 cursor-pointer group">
                    <div className="col-span-1">
                      <span className="text-[13px] font-light text-white/25">{i + 1}</span>
                    </div>
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                        {c.platform.includes("IG") ? <Instagram className="h-4 w-4 text-pink-400/70" /> : <Youtube className="h-4 w-4 text-red-400/70" />}
                      </div>
                      <span className="text-[13px] font-light text-white/70 group-hover:text-white truncate transition-colors">{c.title}</span>
                    </div>
                    <div className="col-span-2 text-right text-[13px] font-light text-white">{c.views}</div>
                    <div className="col-span-1 text-right text-[13px] font-light text-white/50">{c.saves}</div>
                    <div className="col-span-1 text-right text-[13px] font-light text-white/50">{c.likes}</div>
                    <div className="col-span-1 text-center">
                      <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{c.engRate}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="pill-badge">{c.platform}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-[13px] text-white/20 font-light">No hay contenido aún</p>
              </div>
            )}
          </div>

        </div>

        {/* ── RIGHT: Summary Panel (30%) ── */}
        <div className="w-[320px] shrink-0 space-y-6">
          {/* Quick Stats */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
            <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em] mb-5">Resumen Rápido</h3>
            <div className="space-y-5">
              {quickStats.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-white/35 font-light">{s.label}</p>
                    <p className="text-[11px] text-white/20 font-light mt-0.5">{s.sub}</p>
                  </div>
                  <CountUp value={s.value} className={`text-[22px] font-light tracking-[-0.02em] ${s.value.startsWith("$") ? "text-emerald-300" : "text-white"}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Metas del Mes — Donuts */}
          <MetasDonut
            views={data?.kpis[0]?.value ?? "—"}
            followers={quickStats.find(s => s.label === "Nuevos Follows")?.value ?? "—"}
            engRate={quickStats.find(s => s.label === "Tasa de Engagement")?.value ?? "—"}
          />

          {/* Top Ventas */}
          {salesChartData.length > 0 && (() => {
            const maxAmount = salesChartData[0].amount;
            const total = salesChartData.reduce((s, d) => s + d.amount, 0);
            return (
              <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">Top Ventas</h3>
                  <span className="text-[15px] font-light text-emerald-300">${formatCompact(total)}</span>
                </div>
                <p className="text-[10px] text-white/20 mb-4">desde reels</p>
                <div className="space-y-3">
                  {salesChartData.map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-white/25 w-3 shrink-0">{i + 1}</span>
                        <span className="text-[10px] text-white/50 flex-1 truncate font-light">{d.caption}</span>
                        <span className="text-[11px] text-emerald-300 font-light shrink-0">${formatCompact(d.amount)}</span>
                      </div>
                      <div className="h-[3px] w-full rounded-full overflow-hidden ml-5" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${Math.round((d.amount / maxAmount) * 88)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Calendario full-width ── */}
      <div className="mt-6 animate-slide-up stagger-6">
        <ContentCalendar reels={calendarReels} />
      </div>
    </div>
  );
}
