import { Eye, Heart, Bookmark, MessageSquare, TrendingUp, Target, Users, Megaphone, Instagram, Youtube } from "lucide-react";

export default function Home() {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
  const organicViews = [120, 180, 150, 220, 280, 310];
  const adsViews = [40, 60, 90, 110, 130, 160];
  const maxViews = Math.max(...organicViews, ...adsViews);

  const goals = [
    { label: "Seguidores IG", current: 19000, target: 25000, unit: "" },
    { label: "Subs YouTube", current: 4200, target: 5000, unit: "" },
    { label: "Views Orgánicas", current: 310000, target: 500000, unit: "K" },
    { label: "Leads Mes", current: 87, target: 120, unit: "" },
  ];

  const topContent = [
    { title: "Errores que te cuestan $10K/mes", platform: "IG Reel", views: "234K", saves: "3.2K", likes: "8.1K", retention: "62%" },
    { title: "Cómo escalar sin equipo", platform: "IG Reel", views: "189K", saves: "2.8K", likes: "6.4K", retention: "58%" },
    { title: "Mi sistema de contenido", platform: "YouTube", views: "45K", saves: "1.1K", likes: "2.3K", retention: "44%" },
    { title: "3 ads que convirtieron", platform: "IG Reel", views: "156K", saves: "2.1K", likes: "5.9K", retention: "55%" },
  ];

  const countryData = {
    organic: [
      { country: "🇪🇸 España", pct: 38 },
      { country: "🇲🇽 México", pct: 22 },
      { country: "🇦🇷 Argentina", pct: 18 },
      { country: "🇨🇴 Colombia", pct: 12 },
      { country: "🇨🇱 Chile", pct: 10 },
    ],
    ads: [
      { country: "🇦🇷 Argentina", pct: 35 },
      { country: "🇪🇸 España", pct: 25 },
      { country: "🇲🇽 México", pct: 20 },
      { country: "🇨🇴 Colombia", pct: 12 },
      { country: "🇨🇱 Chile", pct: 8 },
    ],
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-zinc-400 mt-1 text-sm">Resumen global de tu marca personal.</p>
      </div>

      {/* ROW 1: Chart + Monthly Goals + Key Metrics */}
      <div className="grid grid-cols-12 gap-6">
        {/* Organic Views Chart (mimicking the wireframe graph) */}
        <div className="col-span-5 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">Organic Views vs Ads Views</h3>
            <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-400 outline-none">
              <option className="bg-zinc-900">6 meses</option>
            </select>
          </div>
          {/* Simple bar chart */}
          <div className="flex items-end gap-3 h-40">
            {months.map((month, i) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end justify-center h-32">
                  <div
                    className="w-3 rounded-t bg-blue-500/70"
                    style={{ height: `${(organicViews[i] / maxViews) * 100}%` }}
                    title={`Orgánico: ${organicViews[i]}K`}
                  />
                  <div
                    className="w-3 rounded-t bg-purple-500/50"
                    style={{ height: `${(adsViews[i] / maxViews) * 100}%` }}
                    title={`Ads: ${adsViews[i]}K`}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">{month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] text-zinc-500">
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm bg-blue-500/70" />Orgánico</div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm bg-purple-500/50" />Ads</div>
          </div>
        </div>

        {/* Monthly Goals */}
        <div className="col-span-4 glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Monthly Goals</h3>
          <div className="space-y-4">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <div key={g.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-400">{g.label}</span>
                    <span className="text-xs font-medium text-zinc-200">
                      {g.unit === "K" ? `${(g.current / 1000).toFixed(0)}K` : g.current.toLocaleString()} / {g.unit === "K" ? `${(g.target / 1000).toFixed(0)}K` : g.target.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Key Numbers */}
        <div className="col-span-3 grid grid-rows-4 gap-3">
          {[
            { label: "Total Views", value: "1.2M", icon: Eye, color: "text-blue-400" },
            { label: "Guardados", value: "12.4K", icon: Bookmark, color: "text-amber-400" },
            { label: "Likes", value: "45.2K", icon: Heart, color: "text-rose-400" },
            { label: "Comentarios", value: "3.8K", icon: MessageSquare, color: "text-emerald-400" },
          ].map((m) => (
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

      {/* ROW 2: Views by Country + Top Performing Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Views by country: Organic vs Ads */}
        <div className="col-span-5 glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Views por País</h3>
          <div className="grid grid-cols-2 gap-6">
            {/* Organic */}
            <div>
              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-3">Orgánico</p>
              <div className="space-y-2.5">
                {countryData.organic.map((c) => (
                  <div key={c.country} className="flex items-center gap-2">
                    <span className="text-xs w-24 truncate text-zinc-300">{c.country}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500 w-8 text-right">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Ads */}
            <div>
              <p className="text-[10px] font-medium text-purple-400 uppercase tracking-wider mb-3">Ads</p>
              <div className="space-y-2.5">
                {countryData.ads.map((c) => (
                  <div key={c.country} className="flex items-center gap-2">
                    <span className="text-xs w-24 truncate text-zinc-300">{c.country}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500/60" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500 w-8 text-right">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Performing Content */}
        <div className="col-span-7 glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Top Performing Content</h3>
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 uppercase tracking-wider pb-2 border-b border-white/5">
              <div className="col-span-5">Título</div>
              <div className="col-span-1 text-center">Views</div>
              <div className="col-span-1 text-center">Saves</div>
              <div className="col-span-1 text-center">Likes</div>
              <div className="col-span-2 text-center">Retención</div>
              <div className="col-span-2 text-center">Plataforma</div>
            </div>
            {topContent.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center py-3 rounded-lg hover:bg-white/5 transition-colors px-1 cursor-pointer group">
                <div className="col-span-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {c.platform.includes("IG") ? <Instagram className="h-4 w-4 text-pink-400" /> : <Youtube className="h-4 w-4 text-red-400" />}
                  </div>
                  <span className="text-sm text-zinc-200 group-hover:text-white truncate transition-colors">{c.title}</span>
                </div>
                <div className="col-span-1 text-center text-xs font-medium text-zinc-300">{c.views}</div>
                <div className="col-span-1 text-center text-xs text-zinc-400">{c.saves}</div>
                <div className="col-span-1 text-center text-xs text-zinc-400">{c.likes}</div>
                <div className="col-span-2 text-center">
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{c.retention}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[10px] font-medium text-zinc-500 bg-white/5 px-2 py-1 rounded">{c.platform}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
