"use client";

import { Eye, Heart, Bookmark, MessageSquare, Instagram, Youtube, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { CountUp } from "@/components/ui/CountUp";

export default function Home() {
  const goals = [
    { label: "Seguidores IG", current: 19000, target: 25000, color: "from-violet-500 to-violet-400" },
    { label: "Subs YouTube", current: 4200, target: 5000, color: "from-red-500 to-red-400" },
    { label: "Views Orgánicas", current: 310, target: 500, unit: "K", color: "from-cyan-500 to-cyan-400" },
    { label: "Leads Mes", current: 87, target: 120, color: "from-emerald-500 to-emerald-400" },
  ];

  const topContent = [
    { title: "Errores que te cuestan $10K/mes", platform: "IG Reel", views: "234K", saves: "3.2K", likes: "8.1K", retention: "62%", trend: "up" as const },
    { title: "Cómo escalar sin equipo", platform: "IG Reel", views: "189K", saves: "2.8K", likes: "6.4K", retention: "58%", trend: "up" as const },
    { title: "Mi sistema de contenido", platform: "YouTube", views: "45K", saves: "1.1K", likes: "2.3K", retention: "44%", trend: "down" as const },
    { title: "3 ads que convirtieron", platform: "IG Reel", views: "156K", saves: "2.1K", likes: "5.9K", retention: "55%", trend: "up" as const },
  ];

  const kpis = [
    { label: "Total Views", value: "1.2M", change: "+18.2%", up: true, icon: Eye, color: "text-blue-400" },
    { label: "Guardados", value: "12.4K", change: "+24.5%", up: true, icon: Bookmark, color: "text-amber-400" },
    { label: "Likes", value: "45.2K", change: "+12.1%", up: true, icon: Heart, color: "text-rose-400" },
    { label: "Comentarios", value: "3.8K", change: "-3.2%", up: false, icon: MessageSquare, color: "text-emerald-400" },
  ];

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
            {kpis.map((m, i) => (
              <div key={m.label} className={`glass-card px-6 py-5 animate-slide-up stagger-${i + 1}`}>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <p className="stat-label">{m.label}</p>
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${m.color}`} style={{ background: "rgba(255,255,255,0.06)" }}>
                    <m.icon className="h-[18px] w-[18px]" />
                  </div>
                </div>
                <CountUp value={m.value} className="stat-number-xl relative z-10" />
                <div className="flex items-center gap-1.5 mt-3 relative z-10">
                  {m.up ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span className={`text-[12px] font-medium ${m.up ? "text-emerald-400" : "text-red-400"}`}>{m.change}</span>
                  <span className="text-[11px] text-white/25 ml-1">vs prev</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row — Recharts */}
          <div className="animate-slide-up stagger-5">
            <DashboardCharts />
          </div>

          {/* Top Performing Content */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-light text-white tracking-wide">Top Performing Content</h3>
              <span className="text-[11px] text-white/30 font-medium uppercase tracking-[0.1em]">Últimos 90 días</span>
            </div>
            <div className="space-y-1">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Título</div>
                <div className="col-span-2 text-right">Views</div>
                <div className="col-span-1 text-right">Saves</div>
                <div className="col-span-1 text-right">Likes</div>
                <div className="col-span-1 text-center">Ret.</div>
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
                    <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{c.retention}</span>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="pill-badge">{c.platform}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Summary Panel (30%) ── */}
        <div className="w-[320px] shrink-0 space-y-6">
          {/* Quick Stats */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
            <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em] mb-5">Resumen Rápido</h3>
            <div className="space-y-5">
              {[
                { label: "Alcance Total", value: "892K", sub: "últimos 30 días" },
                { label: "Engagement Rate", value: "6.1%", sub: "+0.8% vs anterior" },
                { label: "Mejor Reel", value: "1.1M", sub: "views" },
                { label: "Nuevos Follows", value: "2.3K", sub: "esta semana" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-white/35 font-light">{s.label}</p>
                    <p className="text-[11px] text-white/20 font-light mt-0.5">{s.sub}</p>
                  </div>
                  <CountUp value={s.value} className="text-[22px] font-light tracking-[-0.02em] text-white" />
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Goals */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-3">
            <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em] mb-5">Monthly Goals</h3>
            <div className="space-y-5">
              {goals.map((g) => {
                const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                const displayCurrent = g.unit === "K" ? `${g.current}K` : g.current.toLocaleString();
                const displayTarget = g.unit === "K" ? `${g.target}K` : g.target.toLocaleString();
                return (
                  <div key={g.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-white/50 font-light">{g.label}</span>
                      <span className="text-[12px] font-light text-white/70">
                        {displayCurrent} <span className="text-white/25">/ {displayTarget}</span>
                      </span>
                    </div>
                    <div className="h-[5px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${g.color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-end mt-1">
                      <span className="text-[10px] text-white/20 font-light">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Views by Country */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-4">
            <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em] mb-5">Top Países</h3>
            <div className="space-y-3">
              {[
                { country: "España", pct: 38, flag: "🇪🇸" },
                { country: "México", pct: 22, flag: "🇲🇽" },
                { country: "Argentina", pct: 18, flag: "🇦🇷" },
                { country: "Colombia", pct: 12, flag: "🇨🇴" },
                { country: "Chile", pct: 10, flag: "🇨🇱" },
              ].map((c) => (
                <div key={c.country} className="flex items-center gap-3">
                  <span className="text-[14px]">{c.flag}</span>
                  <span className="text-[12px] font-light text-white/60 w-20">{c.country}</span>
                  <div className="flex-1 h-[4px] rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full bg-white/20" style={{ width: `${c.pct}%` }} />
                  </div>
                  <span className="text-[11px] text-white/30 font-light w-8 text-right">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
