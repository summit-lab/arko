"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, MousePointerClick, Eye, TrendingUp, BarChart3,
  ChevronDown, ChevronUp, Globe, RefreshCw, Play, ArrowRight, Zap,
  CheckCircle2, AlertTriangle, Wifi, WifiOff, Video,
} from "lucide-react";
import {
  Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

import { DateFilter } from "@/components/ui/DateFilter";
import type { DateRange } from "@/types/date-filter";
import { resolvePreset, dateRangeToParams } from "@/lib/date-utils";

interface AdRow {
  ad_id: string;
  ad_name: string;
  adset_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  video_plays: number;
  ctr: number;
}

interface Campaign {
  campaign_id: string;
  adset_ids: string[];
  ad_count: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  video_plays: number;
  ctr: number;
  cpm: number;
  ads: AdRow[];
}

interface Overview {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalVideoPlays: number;
  totalReach: number;
  avgCtr: number;
  avgCpm: number;
}

interface Trends {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  videoPlays: number;
}

interface DailyPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  video_plays: number;
  cpm: number;
}

interface AdsData {
  connected: boolean;
  adAccountCount: number;
  lastValidatedAt: string | null;
  lastSync: { completedAt: string | null; status: string; metadata: Record<string, unknown> | null } | null;
  overview: Overview;
  campaigns: Campaign[];
  trends: Trends;
  dailySeries: DailyPoint[];
  hasDailyData: boolean;
  isEmpty: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Justo ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function ctrColor(ctr: number) {
  if (ctr >= 4.0) return "#34d399";
  if (ctr >= 2.5) return "#818cf8";
  return "#f59e0b";
}

function cpmColor(cpm: number) {
  if (cpm <= 7)  return "#34d399";
  if (cpm <= 10) return "#818cf8";
  return "#f472b6";
}

function campaignLabel(c: Campaign, idx: number): string {
  const topAd = c.ads.sort((a, b) => b.spend - a.spend)[0];
  if (topAd?.ad_name) return `Campaña ${idx + 1} · ${topAd.ad_name.split(" – ")[0]}`;
  return `Campaña ${c.campaign_id.slice(-6)}`;
}

/** Format chart date labels: "2026-04-05" → "5 abr" */
function fmtChartDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDate();
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${day} ${months[d.getMonth()]}`;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { color: string; name: string; value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fmtVal = (key: string, val: number) => {
    if (key === "spend") return `$${val.toLocaleString()}`;
    if (key === "cpm")   return `$${val.toFixed(1)}`;
    return fmt(val);
  };
  return (
    <div className="rounded-xl px-4 py-3 backdrop-blur-xl"
      style={{ background: "rgba(10,10,20,0.85)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}>
      <p className="text-[11px] text-white/40 mb-2">{label}</p>
      {payload.map((e) => (
        <div key={e.dataKey} className="flex items-center gap-2 text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: e.color }} />
          <span className="text-white/50">{e.name}</span>
          <span className="text-white/80 font-light ml-auto pl-4">{fmtVal(e.dataKey, e.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Campaign expanded panel ──────────────────────────────────────────────────

function CampaignDetail({ c }: { c: Campaign }) {
  const maxAdSpend = Math.max(...c.ads.map((a) => a.spend), 1);

  return (
    <div className="px-5 pb-5 pt-1 border-t border-white/[0.04] space-y-5">
      <div className="grid grid-cols-12 gap-4">

        {/* Mini bar chart — clicks por ad */}
        <div className="col-span-4">
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-3">Clicks por ad</p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.ads.map((a) => ({ name: a.ad_name.split(" – ")[1] ?? a.ad_name.slice(0, 12), clicks: a.clicks }))}
                margin={{ top: 4, right: 0, left: -32, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 8 }} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 9 }}
                  tickFormatter={(v: number) => fmt(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="clicks" name="Clicks" fill="#818cf8" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="col-span-4">
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-3">Funnel de conversión</p>
          <div className="space-y-2.5">
            {[
              { label: "Impresiones", value: fmt(c.impressions), pct: 100,   color: "#818cf8" },
              { label: "Clicks",      value: fmt(c.clicks),      pct: (c.clicks / c.impressions) * 100, color: "#22d3ee" },
              { label: "Video plays", value: fmt(c.video_plays), pct: (c.video_plays / c.impressions) * 100, color: "#34d399" },
            ].map((step, i) => (
              <div key={step.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/35">{step.label}</span>
                  <span className="text-[11px] text-white/65 font-light">{step.value}</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(step.pct, 100)}%`, background: step.color, opacity: 0.65 }} />
                </div>
                {i < 2 && (
                  <div className="flex items-center gap-1 mt-0.5 ml-0.5">
                    <ArrowRight size={8} className="text-white/15" />
                    <span className="text-[9px] text-white/20">
                      {i === 0 ? `${c.ctr.toFixed(1)}% CTR` : `${((c.video_plays / c.clicks) * 100).toFixed(0)}% de clicks ven el video`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Key metrics */}
        <div className="col-span-4">
          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-3">Métricas clave</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "CPM",          value: `$${c.cpm.toFixed(2)}`,          color: cpmColor(c.cpm) },
              { label: "CTR",          value: `${c.ctr.toFixed(2)}%`,          color: ctrColor(c.ctr) },
              { label: "Reach",        value: fmt(c.reach),                    color: "rgba(255,255,255,0.7)" },
              { label: "Video Plays",  value: fmt(c.video_plays),              color: "#22d3ee" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">{m.label}</p>
                <p className="text-[15px] font-light" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ads breakdown */}
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-wider mb-3">Ads en esta campaña</p>
        <div className="space-y-2">
          {c.ads.map((ad) => (
            <div key={ad.ad_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="h-7 w-7 rounded-md shrink-0 flex items-center justify-center"
                style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.15)" }}>
                <Play size={10} className="text-indigo-400/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/60 truncate">{ad.ad_name}</p>
                <div className="h-1 w-full rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${(ad.spend / maxAdSpend) * 100}%`, background: "linear-gradient(90deg,#818cf8,#22d3ee)", opacity: 0.5 }} />
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-[10px]">
                <span className="text-white/30">${ad.spend.toFixed(0)}</span>
                <span style={{ color: ctrColor(ad.ctr) }}>{ad.ctr.toFixed(1)}% CTR</span>
                <span className="text-white/30">{fmt(ad.clicks)} clicks</span>
                <span className="text-white/25">{fmt(ad.video_plays)} plays</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdsClient({ workspaceId }: { workspaceId: string }) {
  const [dateRange, setDateRange]   = useState<DateRange>(() => resolvePreset("30d"));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState<string | null>(null);
  const [adsData, setAdsData]       = useState<AdsData | null>(null);
  const [loading, setLoading]       = useState(true);

  // Fetch real data with date range
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = dateRangeToParams(dateRange);
      const res  = await fetch(`/api/v1/ads?workspace_id=${workspaceId}&${params}`);
      const json = await res.json() as { data?: AdsData };
      if (res.ok && json.data) setAdsData(json.data);
    } catch { /* silent */ }
    finally  { setLoading(false); }
  }, [workspaceId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overview     = adsData?.overview ?? { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalVideoPlays: 0, totalReach: 0, avgCtr: 0, avgCpm: 0 };
  const campaigns    = adsData?.campaigns ?? [];
  const trends       = adsData?.trends ?? { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpm: 0, videoPlays: 0 };
  const dailySeries  = adsData?.dailySeries ?? [];
  const hasDailyData = adsData?.hasDailyData ?? false;

  // Sync action
  async function handleSync() {
    setSyncing(true);
    setSyncMsg("Sincronizando datos de Meta Ads…");
    try {
      const res = await fetch(`/api/v1/sync/instagram?steps=all&workspace_id=${workspaceId}`, { method: "POST" });
      if (res.ok) {
        setSyncMsg("Sincronización completada. Actualizando…");
        await fetchData();
        setSyncMsg(null);
      } else {
        setSyncMsg("Error al sincronizar. Intentá de nuevo.");
        setTimeout(() => setSyncMsg(null), 4000);
      }
    } catch {
      setSyncMsg("Error de conexión.");
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setSyncing(false);
    }
  }

  // KPIs — real data with real trends
  const KPIS = [
    { label: "Spend Total",    value: `$${overview.totalSpend >= 1000 ? `${(overview.totalSpend / 1000).toFixed(1)}K` : overview.totalSpend.toFixed(0)}`, trend: trends.spend,      icon: DollarSign,       color: "#818cf8" },
    { label: "Impresiones",    value: fmt(overview.totalImpressions), trend: trends.impressions,  icon: Eye,              color: "#34d399" },
    { label: "Clicks",         value: fmt(overview.totalClicks),      trend: trends.clicks,       icon: MousePointerClick, color: "#22d3ee" },
    { label: "CTR Promedio",   value: `${overview.avgCtr.toFixed(1)}%`, trend: trends.ctr,        icon: TrendingUp,       color: "#f472b6" },
    { label: "CPM Promedio",   value: `$${overview.avgCpm.toFixed(2)}`, trend: trends.cpm,        icon: BarChart3,        color: "#818cf8", invertTrend: true },
    { label: "Video Plays",    value: fmt(overview.totalVideoPlays),  trend: trends.videoPlays,   icon: Video,            color: "#34d399" },
  ];

  // Chart data with formatted dates
  const chartData = dailySeries.map((d) => ({ ...d, dateLabel: fmtChartDate(d.date) }));

  return (
    <div className="p-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between relative" style={{ zIndex: 100 }}>
        <div>
          <h1 className="page-title">Ads Intelligence</h1>
          <p className="text-white/30 mt-1 text-[13px] font-light">Análisis de Meta Ads: data cuantitativa y cualitativa.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateFilter mode="state" defaultPreset="30d" onChange={setDateRange} />
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando…" : "Sincronizar Ads"}
          </button>
        </div>
      </div>

      {/* ── Connection status bar ── */}
      {!loading && (
        <div className="glass-panel rounded-xl px-5 py-3 flex items-center gap-4">
          {adsData?.connected ? (
            <div className="flex items-center gap-2 text-[12px] font-light text-emerald-400/80">
              <Wifi size={13} />
              Meta Ads conectado
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] font-light text-white/30">
              <WifiOff size={13} />
              Meta Ads no conectado
            </div>
          )}

          <div className="h-3 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          <div className="flex items-center gap-2 text-[11px] text-white/30 font-light">
            {adsData?.lastSync?.status === "completed"
              ? <CheckCircle2 size={12} className="text-emerald-400/50" />
              : <AlertTriangle size={12} className="text-amber-400/50" />}
            Último sync: {fmtDate(adsData?.lastSync?.completedAt ?? null)}
          </div>

          {syncMsg && (
            <>
              <div className="h-3 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-[11px] text-violet-400/70 font-light animate-pulse">{syncMsg}</span>
            </>
          )}

          {adsData?.isEmpty && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px]"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
              <Zap size={10} />
              Sin datos — sincronizá para cargar métricas
            </div>
          )}

          {!adsData?.isEmpty && !hasDailyData && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px]"
              style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)", color: "#818cf8" }}>
              <RefreshCw size={10} />
              Sincronizá para activar filtro por fechas y tendencias
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-6 gap-3">
        {KPIS.map((k) => {
          const positive = (k as { invertTrend?: boolean }).invertTrend ? k.trend < 0 : k.trend > 0;
          const hasTrend = hasDailyData && k.trend !== 0;
          const Icon = k.icon;
          return (
            <div key={k.label} className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${k.color}14`, border: `1px solid ${k.color}30` }}>
                  <Icon size={14} style={{ color: k.color }} />
                </div>
                {hasTrend ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ color: positive ? "#34d399" : "#f472b6", background: positive ? "rgba(52,211,153,0.1)" : "rgba(244,114,182,0.1)" }}>
                    {k.trend > 0 ? "+" : ""}{k.trend}%
                  </span>
                ) : (
                  <span className="text-[9px] text-white/15 px-1.5 py-0.5 rounded-full"
                    style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                    {hasDailyData ? "=" : "—"}
                  </span>
                )}
              </div>
              <p className="stat-number text-[26px] text-white/85">{k.value}</p>
              <p className="stat-label mt-1">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Performance chart ── */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[15px] text-white/70 font-extralight">Performance en el tiempo</p>
            <p className="text-[11px] text-white/25 font-light mt-0.5">
              Spend, clicks y CPM{!hasDailyData && " — sincronizá para ver el gráfico"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-white/25">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#818cf8]" />Spend</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34d399]" />Clicks</span>
            <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-[#f472b6]" />CPM</span>
          </div>
        </div>
        <div className="h-52">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 10 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10 }}
                  tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10 }}
                  tickFormatter={(v: number) => fmt(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.05)", strokeWidth: 1 }} />
                <Area yAxisId="left"  type="monotone" dataKey="spend"  name="Spend"  stroke="#818cf8" strokeWidth={2} fill="url(#gSpend)"  dot={false} />
                <Area yAxisId="right" type="monotone" dataKey="clicks" name="Clicks" stroke="#34d399" strokeWidth={2} fill="url(#gClicks)" dot={false} />
                <Line yAxisId="left"  type="monotone" dataKey="cpm"    name="CPM"    stroke="#f472b6" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/15 text-[13px] font-light">
              {loading ? "Cargando…" : "Sin datos diarios disponibles. Sincronizá para generar el gráfico."}
            </div>
          )}
        </div>
      </div>

      {/* ── Campaigns + Geo ── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Campaigns table */}
        <div className="col-span-8 glass-panel rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <p className="text-[15px] text-white/70 font-extralight">Campañas</p>
            <span className="text-[10px] text-white/20">{campaigns.length} campañas</span>
          </div>
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 text-[9px] text-white/20 uppercase tracking-widest px-6 py-3 border-b border-white/[0.03]">
            <div className="col-span-4">Campaña</div>
            <div className="col-span-1 text-right">Spend</div>
            <div className="col-span-2 text-right">Impresiones</div>
            <div className="col-span-1 text-right">Clicks</div>
            <div className="col-span-1 text-right">CTR</div>
            <div className="col-span-1 text-right">CPM</div>
            <div className="col-span-1 text-right">Plays</div>
            <div className="col-span-1" />
          </div>

          {campaigns.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-white/20 text-[13px] font-light">
              Sin campañas en este período
            </div>
          )}

          {campaigns.map((c, idx) => {
            const isOpen = expandedId === c.campaign_id;
            const label  = campaignLabel(c, idx);
            return (
              <div key={c.campaign_id} className="border-b border-white/[0.03] last:border-0">
                <div
                  className="grid grid-cols-12 gap-2 items-center px-6 py-4 cursor-pointer transition-colors"
                  style={{ background: isOpen ? "rgba(255,255,255,0.02)" : undefined }}
                  onClick={() => setExpandedId(isOpen ? null : c.campaign_id)}
                  onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "rgba(255,255,255,0.012)"; }}
                  onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = ""; }}
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center"
                      style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.15)" }}>
                      <Zap size={12} className="text-indigo-400/60" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] text-white/65 truncate font-light">{label}</p>
                      <p className="text-[10px] text-white/22">{c.ad_count} ads · {c.adset_ids.length} ad sets</p>
                    </div>
                  </div>
                  <div className="col-span-1 text-right text-[12px] text-white/60 font-light">${c.spend.toFixed(0)}</div>
                  <div className="col-span-2 text-right text-[11px] text-white/40">{fmt(c.impressions)}</div>
                  <div className="col-span-1 text-right text-[11px] text-white/40">{fmt(c.clicks)}</div>
                  <div className="col-span-1 text-right">
                    <span className="text-[11px] font-light" style={{ color: ctrColor(c.ctr) }}>{c.ctr.toFixed(1)}%</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-[11px] font-light" style={{ color: cpmColor(c.cpm) }}>${c.cpm.toFixed(1)}</span>
                  </div>
                  <div className="col-span-1 text-right text-[11px] text-white/30">{fmt(c.video_plays)}</div>
                  <div className="col-span-1 flex justify-end">
                    {isOpen
                      ? <ChevronUp size={13} className="text-white/25" />
                      : <ChevronDown size={13} className="text-white/15" />}
                  </div>
                </div>
                {isOpen && <CampaignDetail c={c} />}
              </div>
            );
          })}
        </div>

        {/* Geo + CTR mini */}
        <div className="col-span-4 glass-panel rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
            <Globe size={13} className="text-white/25" />
            <p className="text-[15px] text-white/70 font-extralight">CTR por campaña</p>
          </div>

          {/* CTR by campaign chart */}
          <div className="px-5 py-4">
            {campaigns.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={campaigns.map((c, i) => ({ name: `C${i + 1}`, ctr: parseFloat(c.ctr.toFixed(1)) }))}
                    margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 9 }} domain={[0, "auto"]} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="ctr" name="CTR" radius={[4, 4, 0, 0]}>
                      {campaigns.map((c) => (
                        <Cell key={c.campaign_id} fill={ctrColor(c.ctr)} fillOpacity={0.65} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-white/15 text-[12px]">Sin datos</div>
            )}
          </div>

          {/* Overview metrics mini */}
          <div className="px-5 pb-5 border-t border-white/[0.04] pt-4">
            <p className="text-[10px] text-white/20 uppercase tracking-wider mb-3">Resumen del período</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Reach Total", value: fmt(overview.totalReach), color: "rgba(255,255,255,0.6)" },
                { label: "Spend Total", value: `$${overview.totalSpend.toFixed(0)}`, color: "#818cf8" },
                { label: "CTR Avg",     value: `${overview.avgCtr.toFixed(2)}%`, color: ctrColor(overview.avgCtr) },
                { label: "CPM Avg",     value: `$${overview.avgCpm.toFixed(2)}`, color: cpmColor(overview.avgCpm) },
              ].map((m) => (
                <div key={m.label} className="rounded-lg px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-[9px] text-white/22 uppercase tracking-wider mb-0.5">{m.label}</p>
                  <p className="text-[13px] font-light" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Creative ranking ── */}
      {campaigns.length > 0 && (
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <div>
              <p className="text-[15px] text-white/70 font-extralight">Ranking de creativos</p>
              <p className="text-[11px] text-white/25 font-light mt-0.5">Ordenados por CTR · todos los ads</p>
            </div>
            <div className="flex items-center gap-4 text-[9px] text-white/20">
              <span><span className="text-emerald-400/60">●</span> CTR ≥ 4%</span>
              <span><span className="text-violet-400/60">●</span> CTR 2.5–4%</span>
              <span><span className="text-amber-400/60">●</span> CTR &lt; 2.5%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
            {campaigns
              .flatMap((c, ci) => c.ads.map((a) => ({ ...a, campaignLabel: campaignLabel(c, ci) })))
              .sort((a, b) => b.ctr - a.ctr)
              .slice(0, 6)
              .map((ad, idx) => {
                const cc = ctrColor(ad.ctr);
                const isBest = idx === 0;
                return (
                  <div key={ad.ad_id} className="p-5 space-y-4">
                    <div className="h-32 rounded-xl flex items-center justify-center relative overflow-hidden"
                      style={{ background: `${cc}08`, border: `1px solid ${cc}18` }}>
                      <Play size={18} style={{ color: `${cc}30` }} />
                      {isBest && (
                        <div className="absolute top-2 right-2">
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                            style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>Top</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[12px] text-white/60 font-light truncate">{ad.ad_name}</p>
                      <p className="text-[10px] text-white/25 mt-0.5 truncate">{ad.campaignLabel}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: "CTR",    value: `${ad.ctr.toFixed(1)}%`,      color: cc },
                        { label: "Clicks", value: fmt(ad.clicks),               color: "rgba(255,255,255,0.55)" },
                        { label: "Plays",  value: fmt(ad.video_plays),          color: "#22d3ee" },
                      ].map((m) => (
                        <div key={m.label} className="rounded-lg p-2 text-center"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <p className="text-[9px] text-white/22 uppercase tracking-wider mb-0.5">{m.label}</p>
                          <p className="text-[12px] font-light" style={{ color: m.color }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] text-white/20 mb-1">
                        <span>Spend</span><span>${ad.spend.toFixed(0)}</span>
                      </div>
                      <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${(ad.spend / Math.max(...campaigns.flatMap((c) => c.ads.map((a) => a.spend)), 1)) * 100}%`, background: cc, opacity: 0.45 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

    </div>
  );
}
