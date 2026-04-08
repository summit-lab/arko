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

type TimeRange = "7d" | "30d" | "90d";

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

interface AdsData {
  connected: boolean;
  adAccountCount: number;
  lastValidatedAt: string | null;
  lastSync: { completedAt: string | null; status: string; metadata: Record<string, unknown> | null } | null;
  overview: Overview;
  campaigns: Campaign[];
  isEmpty: boolean;
}

// ─── Mock fallback data (shown when DB is empty) ──────────────────────────────

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    campaign_id: "DEMO-001",
    adset_ids: ["as-1a", "as-1b", "as-1c"],
    ad_count: 3, spend: 1240, impressions: 147600, reach: 98000,
    clicks: 4723, video_plays: 89000, ctr: 3.20, cpm: 8.40,
    ads: [
      { ad_id: "a1", ad_name: "Reel A – Hook directo",      adset_id: "as-1a", spend: 680, impressions: 89000, clicks: 3382, video_plays: 62000, ctr: 3.80 },
      { ad_id: "a2", ad_name: "Reel B – Testimonio",        adset_id: "as-1b", spend: 360, impressions: 41000, clicks: 1189, video_plays: 19000, ctr: 2.90 },
      { ad_id: "a3", ad_name: "Reel C – Problema/Solución", adset_id: "as-1c", spend: 200, impressions: 17600, clicks:  546, video_plays:  8000, ctr: 3.10 },
    ],
  },
  {
    campaign_id: "DEMO-002",
    adset_ids: ["as-2a", "as-2b"],
    ad_count: 2, spend: 680, impressions: 109700, reach: 72000,
    clicks: 5266, video_plays: 54000, ctr: 4.80, cpm: 6.20,
    ads: [
      { ad_id: "a4", ad_name: "Carousel – Caso Éxito",     adset_id: "as-2a", spend: 420, impressions: 62000, clicks: 3224, video_plays: 31000, ctr: 5.20 },
      { ad_id: "a5", ad_name: "Reel – Resultados cliente", adset_id: "as-2b", spend: 260, impressions: 47700, clicks: 2196, video_plays: 23000, ctr: 4.60 },
    ],
  },
  {
    campaign_id: "DEMO-003",
    adset_ids: ["as-3a", "as-3b", "as-3c"],
    ad_count: 3, spend: 2100, impressions: 187500, reach: 89000,
    clicks: 3938, video_plays: 91000, ctr: 2.10, cpm: 11.20,
    ads: [
      { ad_id: "a6", ad_name: "Reel – Escalar tutorial",   adset_id: "as-3a", spend: 900, impressions: 112000, clicks: 2688, video_plays: 54000, ctr: 2.40 },
      { ad_id: "a7", ad_name: "Reel – Pain point equipo",  adset_id: "as-3b", spend: 760, impressions:  61000, clicks: 1159, video_plays: 28000, ctr: 1.90 },
      { ad_id: "a8", ad_name: "Story – UGC cliente",       adset_id: "as-3c", spend: 440, impressions:  14500, clicks:  290, video_plays:  9000, ctr: 2.00 },
    ],
  },
  {
    campaign_id: "DEMO-004",
    adset_ids: ["as-4a", "as-4b"],
    ad_count: 3, spend: 890, impressions: 114100, reach: 76000,
    clicks: 3994, video_plays: 68000, ctr: 3.50, cpm: 7.80,
    ads: [
      { ad_id: "a9",  ad_name: "Reel A – Rutina diaria",   adset_id: "as-4a", spend: 500, impressions: 68000, clicks: 2652, video_plays: 38000, ctr: 3.90 },
      { ad_id: "a10", ad_name: "Reel B – Antes/después",   adset_id: "as-4b", spend: 390, impressions: 46100, clicks: 1476, video_plays: 30000, ctr: 3.20 },
    ],
  },
];

const MOCK_OVERVIEW: Overview = {
  totalSpend: 4910, totalImpressions: 558900, totalClicks: 17921,
  totalVideoPlays: 302000, totalReach: 335000,
  avgCtr: 3.21, avgCpm: 8.78,
};

// ─── Perf chart mock data ──────────────────────────────────────────────────────

const PERF_DATA: Record<TimeRange, { date: string; spend: number; clicks: number; cpm: number }[]> = {
  "7d": [
    { date: "Lun", spend: 680,  clicks: 2180, cpm: 8.9  },
    { date: "Mar", spend: 720,  clicks: 2450, cpm: 8.5  },
    { date: "Mié", spend: 690,  clicks: 2100, cpm: 9.1  },
    { date: "Jue", spend: 810,  clicks: 2900, cpm: 8.2  },
    { date: "Vie", spend: 760,  clicks: 2650, cpm: 8.6  },
    { date: "Sáb", spend: 620,  clicks: 1900, cpm: 9.4  },
    { date: "Dom", spend: 580,  clicks: 1740, cpm: 10.1 },
  ],
  "30d": [
    { date: "1",  spend: 620,  clicks: 1850, cpm: 9.8  },
    { date: "5",  spend: 710,  clicks: 2100, cpm: 9.3  },
    { date: "10", spend: 760,  clicks: 2400, cpm: 8.9  },
    { date: "15", spend: 840,  clicks: 2900, cpm: 8.4  },
    { date: "20", spend: 870,  clicks: 3100, cpm: 8.1  },
    { date: "25", spend: 760,  clicks: 2600, cpm: 8.7  },
    { date: "30", spend: 650,  clicks: 2020, cpm: 9.2  },
  ],
  "90d": [
    { date: "Sem 1",  spend: 3200, clicks: 9500,  cpm: 10.2 },
    { date: "Sem 3",  spend: 3800, clicks: 11500, cpm: 9.8  },
    { date: "Sem 5",  spend: 3900, clicks: 12100, cpm: 9.5  },
    { date: "Sem 7",  spend: 4400, clicks: 14200, cpm: 9.1  },
    { date: "Sem 9",  spend: 4300, clicks: 13800, cpm: 9.0  },
    { date: "Sem 11", spend: 5100, clicks: 16800, cpm: 8.6  },
    { date: "Sem 12", spend: 4910, clicks: 15700, cpm: 8.8  },
  ],
};

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

// Campaign display name: use ad names to infer, or truncate ID
function campaignLabel(c: Campaign, idx: number): string {
  if (!c.campaign_id.startsWith("DEMO")) {
    // Try to infer a readable name from the top ad
    const topAd = c.ads.sort((a, b) => b.spend - a.spend)[0];
    if (topAd?.ad_name) return `Campaña ${idx + 1} · ${topAd.ad_name.split(" – ")[0]}`;
    return `Campaña ${c.campaign_id.slice(-6)}`;
  }
  const names = ["Captación - Reel Errores", "Retargeting - Caso de Éxito", "Lookalike - Escalar", "Captación - Mi rutina"];
  return names[idx] ?? `Campaña ${idx + 1}`;
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
  const [range, setRange]           = useState<TimeRange>("30d");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState<string | null>(null);
  const [adsData, setAdsData]       = useState<AdsData | null>(null);
  const [loading, setLoading]       = useState(true);

  // Fetch real data
  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch(`/api/v1/ads?workspace_id=${workspaceId}`);
      const json = await res.json() as { data?: AdsData };
      if (res.ok && json.data) setAdsData(json.data);
    } catch { /* silent */ }
    finally  { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Determine which dataset to show
  const isDemo       = !adsData || adsData.isEmpty;
  const campaigns    = isDemo ? MOCK_CAMPAIGNS : adsData.campaigns;
  const overview     = isDemo ? MOCK_OVERVIEW  : adsData.overview;
  const perfData     = PERF_DATA[range];

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

  // KPIs — real or mock
  const KPIS = [
    { label: "Spend Total",    value: `$${overview.totalSpend >= 1000 ? `${(overview.totalSpend / 1000).toFixed(1)}K` : overview.totalSpend.toFixed(0)}`, trend: +8.2,  icon: DollarSign,       color: "#818cf8" },
    { label: "Impresiones",    value: fmt(overview.totalImpressions), trend: +21.0, icon: Eye,              color: "#34d399" },
    { label: "Clicks",         value: fmt(overview.totalClicks),      trend: +14.3, icon: MousePointerClick, color: "#22d3ee" },
    { label: "CTR Promedio",   value: `${overview.avgCtr.toFixed(1)}%`, trend: +5.7, icon: TrendingUp,     color: "#f472b6" },
    { label: "CPM Promedio",   value: `$${overview.avgCpm.toFixed(2)}`, trend: -8.1, icon: BarChart3,       color: "#818cf8", invertTrend: true },
    { label: "Video Plays",    value: fmt(overview.totalVideoPlays),  trend: +31.0, icon: Video,            color: "#34d399" },
  ];

  return (
    <div className="p-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Ads Intelligence</h1>
          <p className="text-white/30 mt-1 text-[13px] font-light">Análisis de Meta Ads: data cuantitativa y cualitativa.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range */}
          <div className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["7d", "30d", "90d"] as TimeRange[]).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                style={range === r
                  ? { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.1)" }
                  : { color: "rgba(255,255,255,0.3)", border: "1px solid transparent" }}>
                {r}
              </button>
            ))}
          </div>
          {/* Sync button */}
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
          {/* Connection indicator */}
          {adsData?.connected ? (
            <div className="flex items-center gap-2 text-[12px] font-light text-emerald-400/80">
              <Wifi size={13} />
              Meta Ads conectado
              {adsData.adAccountCount > 0 && (
                <span className="text-white/25 text-[11px]">· {adsData.adAccountCount} cuenta{adsData.adAccountCount > 1 ? "s" : ""}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] font-light text-white/30">
              <WifiOff size={13} />
              Meta Ads no conectado
            </div>
          )}

          <div className="h-3 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Last sync */}
          <div className="flex items-center gap-2 text-[11px] text-white/30 font-light">
            {adsData?.lastSync?.status === "completed"
              ? <CheckCircle2 size={12} className="text-emerald-400/50" />
              : <AlertTriangle size={12} className="text-amber-400/50" />}
            Último sync: {fmtDate(adsData?.lastSync?.completedAt ?? null)}
          </div>

          {/* Sync message */}
          {syncMsg && (
            <>
              <div className="h-3 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-[11px] text-violet-400/70 font-light animate-pulse">{syncMsg}</span>
            </>
          )}

          {/* Demo badge */}
          {isDemo && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px]"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
              <Zap size={10} />
              Datos demo — sincronizá para ver datos reales
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-6 gap-3">
        {KPIS.map((k) => {
          const positive = (k as { invertTrend?: boolean }).invertTrend ? k.trend < 0 : k.trend > 0;
          const Icon = k.icon;
          return (
            <div key={k.label} className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${k.color}14`, border: `1px solid ${k.color}30` }}>
                  <Icon size={14} style={{ color: k.color }} />
                </div>
                {isDemo ? (
                  <span className="text-[9px] text-white/15 px-1.5 py-0.5 rounded-full"
                    style={{ border: "1px solid rgba(255,255,255,0.07)" }}>demo</span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ color: positive ? "#34d399" : "#f472b6", background: positive ? "rgba(52,211,153,0.1)" : "rgba(244,114,182,0.1)" }}>
                    {k.trend > 0 ? "+" : ""}{k.trend}%
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
              Spend, clicks y CPM — {range}{isDemo ? " (demo)" : ""}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-white/25">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#818cf8]" />Spend</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#34d399]" />Clicks</span>
            <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-[#f472b6]" />CPM</span>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={perfData} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
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
              <XAxis dataKey="date" axisLine={false} tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 10 }} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10 }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10 }}
                tickFormatter={(v: number) => fmt(v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.05)", strokeWidth: 1 }} />
              <Area yAxisId="left"  type="monotone" dataKey="spend"  name="Spend"  stroke="#818cf8" strokeWidth={2} fill="url(#gSpend)"  dot={false} />
              <Area yAxisId="right" type="monotone" dataKey="clicks" name="Clicks" stroke="#34d399" strokeWidth={2} fill="url(#gClicks)" dot={false} />
              <Line yAxisId="left"  type="monotone" dataKey="cpm"    name="CPM"    stroke="#f472b6" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
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

        {/* Geo + ROAS mini */}
        <div className="col-span-4 glass-panel rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
            <Globe size={13} className="text-white/25" />
            <p className="text-[15px] text-white/70 font-extralight">Leads por país</p>
          </div>

          {/* Geo rows */}
          <div className="px-5 py-4 space-y-4">
            {[
              { country: "España",    code: "ES", organic: 42, ads: 25 },
              { country: "México",    code: "MX", organic: 22, ads: 20 },
              { country: "Argentina", code: "AR", organic: 15, ads: 35 },
              { country: "Colombia",  code: "CO", organic: 12, ads: 12 },
              { country: "Chile",     code: "CL", organic:  9, ads:  8 },
            ].map((row) => (
              <div key={row.code}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-white/50">{row.code} {row.country}</span>
                  <div className="flex items-center gap-3 text-[9px]">
                    <span className="text-blue-400/50">{row.organic}% org.</span>
                    <span className="text-purple-400/50">{row.ads}% ads</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{ width: `${row.organic}%`, background: "#3b82f6", opacity: 0.5 }} />
                  </div>
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{ width: `${row.ads}%`, background: "#a855f7", opacity: 0.5 }} />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-1">
              <span className="flex items-center gap-1.5 text-[9px] text-white/20"><span className="h-1.5 w-3 rounded-full bg-blue-500/50" />Orgánico</span>
              <span className="flex items-center gap-1.5 text-[9px] text-white/20"><span className="h-1.5 w-3 rounded-full bg-purple-500/50" />Ads</span>
            </div>
          </div>

          {/* CTR by campaign mini chart */}
          <div className="px-5 pb-5 border-t border-white/[0.04] pt-4">
            <p className="text-[10px] text-white/20 uppercase tracking-wider mb-3">CTR por campaña</p>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={campaigns.map((c, i) => ({ name: `C${i + 1}`, ctr: parseFloat(c.ctr.toFixed(1)) }))}
                  margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 9 }} domain={[0, 6]} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="ctr" name="CTR" radius={[4, 4, 0, 0]}>
                    {campaigns.map((c) => (
                      <Cell key={c.campaign_id} fill={ctrColor(c.ctr)} fillOpacity={0.65} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Creative ranking ── */}
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
            .map((ad) => {
              const cc = ctrColor(ad.ctr);
              const isBest = ad === campaigns.flatMap((c, ci) => c.ads.map((a) => ({ ...a, campaignLabel: campaignLabel(c, ci) }))).sort((a, b) => b.ctr - a.ctr)[0];
              return (
                <div key={ad.ad_id} className="p-5 space-y-4">
                  {/* Thumbnail placeholder */}
                  <div className="h-32 rounded-xl flex items-center justify-center relative overflow-hidden"
                    style={{ background: `${cc}08`, border: `1px solid ${cc}18` }}>
                    <Play size={18} style={{ color: `${cc}30` }} />
                    {isBest && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                          style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>🔥 Top</span>
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

    </div>
  );
}
