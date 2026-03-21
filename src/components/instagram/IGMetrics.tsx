"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line,
} from "recharts";
import {
  Eye, Users, TrendingUp, Heart, MessageSquare, Bookmark, Share2,
  UserPlus, BarChart3, Globe,
} from "lucide-react";

// ─── Types (match DB schema) ─────────────────────────────────────────────────

interface DayInsight {
  metric_date: string;
  impressions: number;
  reach: number;
  profile_views: number;
  accounts_engaged: number;
  total_interactions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  follower_count: number;
  follows_count: number;
  media_count: number;
}

interface Demographics {
  audience_gender_age: Record<string, number>;
  audience_city: Record<string, number>;
  audience_country: Record<string, number>;
}

interface IGMetricsProps {
  dailyInsights: DayInsight[];
  demographics: Demographics | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${day} ${d.toLocaleString("es", { month: "short", timeZone: "UTC" })}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="stat-label">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${color}`}
          style={{ background: "rgba(255,255,255,0.06)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="stat-number">{value}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-5 py-4 text-[13px]" style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}>
      <p className="mb-2 text-white/40 text-[11px] font-medium uppercase tracking-[0.08em]">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-light text-[15px]" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString("es-AR")}
        </p>
      ))}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-section p-8">
      <h3 className="mb-1 text-[22px] font-extralight tracking-[-0.02em] text-white">{title}</h3>
      {subtitle && <p className="mb-7 text-[13px] font-light text-white/35">{subtitle}</p>}
      {children}
    </div>
  );
}

const PIE_COLORS = ["#818cf8", "#f472b6", "#22d3ee", "#34d399", "#fbbf24", "#a78bfa", "#f97316", "#71717a"];

// ─── Main component ──────────────────────────────────────────────────────────

export function IGMetrics({ dailyInsights, demographics }: IGMetricsProps) {
  if (dailyInsights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-12 w-12 text-zinc-600 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-300">Sin datos de cuenta</h3>
        <p className="mt-2 text-sm text-zinc-500 max-w-md">
          Sincroniza tu cuenta de Instagram para ver métricas de evolución, comunidad y demografía.
          Asegurate de tener los permisos <code className="text-xs bg-white/5 px-1 py-0.5 rounded">instagram_basic</code> e <code className="text-xs bg-white/5 px-1 py-0.5 rounded">instagram_manage_insights</code>.
        </p>
      </div>
    );
  }

  // Prepare chart data sorted by date
  const sorted = [...dailyInsights].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  const chartData = sorted.map((d) => ({
    date: formatDate(d.metric_date),
    rawDate: d.metric_date,
    impressions: d.impressions,
    reach: d.reach,
    interactions: d.total_interactions,
    followers: d.follower_count,
    profile_views: d.profile_views,
  }));

  // Aggregate KPIs
  const totalImpressions = sorted.reduce((s, d) => s + d.impressions, 0);
  const totalReach = sorted.reduce((s, d) => s + d.reach, 0);
  const totalInteractions = sorted.reduce((s, d) => s + d.total_interactions, 0);
  const totalLikes = sorted.reduce((s, d) => s + d.likes, 0);
  const totalComments = sorted.reduce((s, d) => s + d.comments, 0);
  const totalSaves = sorted.reduce((s, d) => s + d.saves, 0);
  const totalShares = sorted.reduce((s, d) => s + d.shares, 0);
  const totalProfileViews = sorted.reduce((s, d) => s + d.profile_views, 0);
  const totalFollowersGained = sorted.reduce((s, d) => s + d.follower_count, 0);
  const avgReach = sorted.length > 0 ? Math.round(totalReach / sorted.length) : 0;
  const avgFollowersGained = sorted.length > 0 ? Math.round(totalFollowersGained / sorted.length) : 0;
  const engagementRate = totalImpressions > 0 ? ((totalInteractions / totalImpressions) * 100).toFixed(2) : "0";

  const lastDay = sorted[sorted.length - 1];
  const bestFollowerDay = sorted.reduce((max, d) => Math.max(max, d.follower_count), 0);

  // Follower balance chart (day-to-day change)
  const followerBalanceData = sorted.map((d) => ({
    date: formatDate(d.metric_date),
    neto: d.follower_count,
  }));

  // Demographics
  const genderData = demographics?.audience_gender_age
    ? processGenderAge(demographics.audience_gender_age)
    : null;
  const countryData = demographics?.audience_country
    ? Object.entries(demographics.audience_country)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }))
    : null;
  const cityData = demographics?.audience_city
    ? Object.entries(demographics.audience_city)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
    : null;

  return (
    <div className="space-y-8">
      {/* ── Hero KPIs — 3 large cards ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card px-6 py-5 flex flex-col justify-center">
          <div className="mb-2 relative z-10">
            <p className="stat-label">Impresiones</p>
          </div>
          <p className="stat-number-xl relative z-10">{formatNumber(totalImpressions)}</p>
        </div>
        <div className="glass-card px-6 py-5 flex flex-col justify-center">
          <div className="mb-2 relative z-10">
            <p className="stat-label">Alcance / día</p>
          </div>
          <p className="stat-number-xl relative z-10">{formatNumber(avgReach)}</p>
        </div>
        <div className="glass-card px-6 py-5 flex flex-col justify-center">
          <div className="mb-2 relative z-10">
            <p className="stat-label">Interacciones</p>
          </div>
          <p className="stat-number-xl relative z-10">{formatNumber(totalInteractions)}</p>
        </div>
      </div>

      {/* ── Secondary KPIs — compact row ── */}
      <div className="grid grid-cols-3 gap-5 md:grid-cols-6">
        {[
          { label: "Engagement", value: `${engagementRate}%` },
          { label: "Seguidores", value: formatNumber(totalFollowersGained) },
          { label: "Mejor día", value: formatNumber(bestFollowerDay) },
          { label: "Me gusta", value: formatNumber(totalLikes) },
          { label: "Guardados", value: formatNumber(totalSaves) },
          { label: "Compartidos", value: formatNumber(totalShares) },
        ].map((s) => (
          <div key={s.label} className="glass-card px-6 py-5 flex flex-col justify-center">
            <p className="stat-label mb-2 relative z-10">{s.label}</p>
            <p className="text-[24px] font-medium tracking-tight text-white leading-none relative z-10">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Evolución general — full width chart ── */}
      <Section title="Evolución general" subtitle={`Impresiones, alcance e interacciones — últimos ${sorted.length} días`}>
        <div className="h-[360px] w-full neon-line-cyan">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 7) - 1)} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.35)", paddingTop: 16 }} />
              <Area type="monotone" dataKey="impressions" name="Impresiones" stroke="#818cf8" fill="url(#impGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="reach" name="Alcance" stroke="#22d3ee" fill="url(#reachGrad)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="interactions" name="Interacciones" stroke="#f472b6" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* ── Two-column: Comunidad + Engagement breakdown ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Comunidad — followers chart */}
        <Section title="Comunidad" subtitle="Captación diaria de seguidores">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="glass-card px-5 py-4">
              <p className="stat-label mb-2">Nuevos seguidores</p>
              <p className="text-[22px] font-light text-white">{formatNumber(totalFollowersGained)}</p>
            </div>
            <div className="glass-card px-5 py-4">
              <p className="stat-label mb-2">Promedio / día</p>
              <p className="text-[22px] font-light text-white">{formatNumber(avgFollowersGained)}</p>
            </div>
          </div>
          {followerBalanceData.length > 0 && (
            <div className="h-[200px] w-full neon-line-emerald">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={followerBalanceData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(followerBalanceData.length / 7) - 1)} />
                  <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="neto" name="Nuevos seguidores" fill="#34d399" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* Interacciones breakdown — compact stats */}
        <Section title="Interacciones" subtitle="Desglose orgánico del período">
          <div className="space-y-4">
            {[
              { label: "Me gusta", value: totalLikes, icon: Heart, color: "#f472b6" },
              { label: "Comentarios", value: totalComments, icon: MessageSquare, color: "#34d399" },
              { label: "Guardados", value: totalSaves, icon: Bookmark, color: "#fbbf24" },
              { label: "Compartidos", value: totalShares, icon: Share2, color: "#60a5fa" },
              { label: "Visitas perfil", value: totalProfileViews, icon: Users, color: "#22d3ee" },
              { label: "Contenido", value: lastDay?.media_count ?? 0, icon: BarChart3, color: "#a78bfa" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" style={{ color: item.color }} />
                  <span className="text-[13px] font-light text-white/60">{item.label}</span>
                </div>
                <span className="text-[18px] font-light text-white">{formatNumber(item.value)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Demografía — 2x2 grid ── */}
      {demographics && (genderData || countryData || cityData) && (
        <Section title="Demografía" subtitle="Distribución de la audiencia (datos lifetime)">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Gender */}
            {genderData && genderData.genderPie.length > 0 && (
              <div className="glass-card p-6">
                <p className="stat-label mb-5">Género</p>
                <div className="flex items-center gap-10">
                  <div className="h-[170px] w-[170px] neon-line-violet">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie data={genderData.genderPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={76} paddingAngle={3} strokeWidth={0}>
                          {genderData.genderPie.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {genderData.genderPie.map((g, i) => (
                      <div key={g.name} className="flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[13px] text-white/40 w-24">{g.name}</span>
                        <span className="text-[16px] font-light text-white">{g.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Age */}
            {genderData && genderData.ageBars.length > 0 && (
              <div className="glass-card p-6">
                <p className="stat-label mb-5">Edad</p>
                <div className="h-[170px] w-full neon-line-cyan">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={genderData.ageBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} width={35} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Seguidores" fill="#818cf8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Country */}
            {countryData && countryData.length > 0 && (
              <div className="glass-card p-6">
                <p className="stat-label mb-5">Seguidores por país</p>
                <div className="flex items-center gap-10">
                  <div className="h-[170px] w-[170px] neon-line-rose">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie data={countryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={76} paddingAngle={3} strokeWidth={0}>
                          {countryData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {countryData.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[13px] text-white/40 w-32 truncate">{c.name}</span>
                        <span className="text-[16px] font-light text-white">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cities */}
            {cityData && cityData.length > 0 && (
              <div className="glass-card p-6">
                <p className="stat-label mb-5">Seguidores por ciudad</p>
                <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <th className="px-5 py-3.5 text-left text-white/40 text-[11px] font-medium uppercase tracking-[0.08em]">Ciudad</th>
                        <th className="px-5 py-3.5 text-right text-white/40 text-[11px] font-medium uppercase tracking-[0.08em]">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityData.map(([city, count]) => (
                        <tr key={city} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                          <td className="px-5 py-3 text-white/70 font-light">{city}</td>
                          <td className="px-5 py-3 text-right font-light text-white">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Process gender+age demographics ─────────────────────────────────────────

function processGenderAge(data: Record<string, number>) {
  const genderTotals: Record<string, number> = {};
  const ageGroups: Record<string, number> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("gender:")) {
      const rawGender = key.replace("gender:", "");
      const genderLabel = rawGender === "M" || rawGender.toLowerCase() === "male"
        ? "Hombre"
        : rawGender === "F" || rawGender.toLowerCase() === "female"
          ? "Mujer"
          : "Desconocido";
      genderTotals[genderLabel] = (genderTotals[genderLabel] || 0) + value;
      continue;
    }

    if (key.startsWith("age:")) {
      const ageRange = key.replace("age:", "");
      ageGroups[ageRange] = (ageGroups[ageRange] || 0) + value;
      continue;
    }

    const [gender, ageRange] = key.split(".");
    if (!gender || !ageRange) continue;

    const genderLabel = gender === "M" ? "Hombre" : gender === "F" ? "Mujer" : "Desconocido";
    genderTotals[genderLabel] = (genderTotals[genderLabel] || 0) + value;
    ageGroups[ageRange] = (ageGroups[ageRange] || 0) + value;
  }

  const totalGender = Object.values(genderTotals).reduce((s, v) => s + v, 0) || 1;
  const genderPie = Object.entries(genderTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: ((value / totalGender) * 100).toFixed(1),
    }));

  const ageBars = Object.entries(ageGroups)
    .sort((a, b) => {
      const aNum = parseInt(a[0]);
      const bNum = parseInt(b[0]);
      return aNum - bNum;
    })
    .map(([range, value]) => ({ range, value }));

  return { genderPie, ageBars };
}
