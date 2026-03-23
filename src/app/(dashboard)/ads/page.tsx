import { DollarSign, Users, MousePointerClick, Eye, TrendingUp, BarChart3, ChevronRight, Image as ImageIcon, Globe } from "lucide-react";

const campaigns = [
  {
    id: 1,
    name: "Captación - Reel Errores $10K",
    status: "active" as const,
    spend: "$1,240",
    leads: 42,
    cpa: "$29.52",
    cpm: "$8.40",
    ctr: "3.2%",
    roas: "4.1x",
    impressions: "147K",
  },
  {
    id: 2,
    name: "Retargeting - Caso de Éxito",
    status: "active" as const,
    spend: "$680",
    leads: 28,
    cpa: "$24.29",
    cpm: "$6.20",
    ctr: "4.8%",
    roas: "5.2x",
    impressions: "109K",
  },
  {
    id: 3,
    name: "Lookalike - Escalar sin equipo",
    status: "paused" as const,
    spend: "$2,100",
    leads: 56,
    cpa: "$37.50",
    cpm: "$11.20",
    ctr: "2.1%",
    roas: "2.8x",
    impressions: "187K",
  },
  {
    id: 4,
    name: "Captación - Mi rutina $100K",
    status: "active" as const,
    spend: "$890",
    leads: 31,
    cpa: "$28.71",
    cpm: "$7.80",
    ctr: "3.5%",
    roas: "3.9x",
    impressions: "114K",
  },
];

const geoComparison = {
  organic: [
    { country: "🇪🇸 España", leads: 34, pct: 42 },
    { country: "🇲🇽 México", leads: 18, pct: 22 },
    { country: "🇦🇷 Argentina", leads: 12, pct: 15 },
    { country: "🇨🇴 Colombia", leads: 10, pct: 12 },
    { country: "🇨🇱 Chile", leads: 7, pct: 9 },
  ],
  ads: [
    { country: "🇦🇷 Argentina", leads: 45, pct: 35 },
    { country: "🇪🇸 España", leads: 32, pct: 25 },
    { country: "🇲🇽 México", leads: 26, pct: 20 },
    { country: "🇨🇴 Colombia", leads: 15, pct: 12 },
    { country: "🇨🇱 Chile", leads: 10, pct: 8 },
  ],
};

const insights = [
  { type: "warning" as const, text: "Ads prioriza Argentina (35%) pero orgánico convierte mejor desde España (42%). Revisar segmentación." },
  { type: "success" as const, text: "El CPA bajó 15% esta semana tras cambiar al creativo B del Reel 'Errores $10K'." },
  { type: "info" as const, text: "Los creativos con formato 'errores/problemas' tienen 2x mejor CTR que los de 'cómo hacer'." },
];

export default function AdsPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Ads Intelligence</h1>
          <p className="text-zinc-400 mt-1 text-sm">Análisis de Meta Ads: data cuantitativa y cualitativa.</p>
        </div>
        <button className="bg-white/10 border border-white/10 text-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors">
          Sincronizar Ads
        </button>
      </div>

      {/* AI Insights */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg border text-xs ${
                insight.type === "warning"
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
                  : insight.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                  : "border-blue-500/20 bg-blue-500/5 text-blue-300"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {insight.text}
            </div>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: "Spend Total", value: "$4,910", icon: DollarSign },
          { label: "Leads Totales", value: "157", icon: Users },
          { label: "CPA Promedio", value: "$31.27", icon: MousePointerClick },
          { label: "CTR Promedio", value: "3.4%", icon: TrendingUp },
          { label: "ROAS Promedio", value: "3.8x", icon: BarChart3 },
          { label: "Impresiones", value: "557K", icon: Eye },
        ].map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
            <s.icon className="h-4 w-4 text-zinc-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Campaigns Table */}
        <div className="col-span-7 glass-panel rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-5">Campañas</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 uppercase tracking-wider pb-2 border-b border-white/5 px-2">
              <div className="col-span-4">Campaña</div>
              <div className="col-span-1 text-center">Spend</div>
              <div className="col-span-1 text-center">Leads</div>
              <div className="col-span-1 text-center">CPA</div>
              <div className="col-span-1 text-center">CTR</div>
              <div className="col-span-1 text-center">ROAS</div>
              <div className="col-span-2 text-center">Estado</div>
              <div className="col-span-1"></div>
            </div>

            {campaigns.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 items-center py-3 px-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                <div className="col-span-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4 text-blue-400/60" />
                  </div>
                  <span className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">{c.name}</span>
                </div>
                <div className="col-span-1 text-center text-xs font-medium text-zinc-300">{c.spend}</div>
                <div className="col-span-1 text-center text-xs text-zinc-300">{c.leads}</div>
                <div className="col-span-1 text-center text-xs text-zinc-400">{c.cpa}</div>
                <div className="col-span-1 text-center text-xs text-zinc-400">{c.ctr}</div>
                <div className="col-span-1 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    parseFloat(c.roas) >= 4 ? "text-emerald-400 bg-emerald-400/10" : parseFloat(c.roas) >= 3 ? "text-blue-400 bg-blue-400/10" : "text-amber-400 bg-amber-400/10"
                  }`}>{c.roas}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-[10px] font-medium px-2 py-1 rounded ${
                    c.status === "active" ? "text-emerald-400 bg-emerald-400/10" : "text-zinc-500 bg-white/5"
                  }`}>
                    {c.status === "active" ? "Activa" : "Pausada"}
                  </span>
                </div>
                <div className="col-span-1 text-right">
                  <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Comparison: Organic vs Ads */}
        <div className="col-span-5 glass-panel rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Leads por País: Orgánico vs Ads</h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-3">Orgánico</p>
              <div className="space-y-3">
                {geoComparison.organic.map((c) => (
                  <div key={c.country}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-300">{c.country}</span>
                      <span className="text-[10px] text-zinc-500">{c.leads} leads ({c.pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-purple-400 uppercase tracking-wider mb-3">Ads</p>
              <div className="space-y-3">
                {geoComparison.ads.map((c) => (
                  <div key={c.country}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-300">{c.country}</span>
                      <span className="text-[10px] text-zinc-500">{c.leads} leads ({c.pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500/60" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
