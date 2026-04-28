"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import {
  Eye, Users, TrendingUp, TrendingDown, Heart, MessageSquare,
  Bookmark, Share2, UserPlus, BarChart3, Activity, Zap, MapPin,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { CountUp } from "@/components/ui/CountUp";
import { useChartTheme } from "@/hooks/useChartTheme";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  followers_total: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(dateStr: string, locale: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(Date.UTC(year, month - 1, day));
  const localeTag = locale === "en" ? "en-US" : "es";
  return `${day} ${d.toLocaleString(localeTag, { month: "short", timeZone: "UTC" })}`;
}

function trendPct(values: number[]): { pct: string; up: boolean } {
  const mid = Math.floor(values.length / 2);
  if (mid === 0) return { pct: "0", up: true };
  const avgA = values.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
  const avgB = values.slice(mid).reduce((s, v) => s + v, 0) / (values.length - mid);
  if (avgA === 0) return { pct: "0", up: true };
  const pct = ((avgB - avgA) / avgA) * 100;
  return { pct: Math.abs(pct).toFixed(0), up: pct >= 0 };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  const locale = useLocale();
  const numLocale = locale === "en" ? "en-US" : "es-AR";
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-[12px] backdrop-blur-xl bg-popover text-popover-foreground border border-border shadow-xl">
      {label && <p className="mb-2 text-muted-foreground text-[11px] font-medium uppercase tracking-[0.08em]">{label}</p>}
      {payload.map((e) => (
        <p key={e.name} className="font-light" style={{ color: e.color }}>
          {e.name}: <span className="text-popover-foreground">{e.value.toLocaleString(numLocale)}</span>
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

function TrendBadge({ pct, up }: { pct: string; up: boolean }) {
  const num = parseFloat(pct);
  const color = up ? "text-emerald-400" : num < 10 ? "text-amber-400" : "text-rose-400";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pct}%
    </span>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ["#7A86E0", "#EB6991", "#4BCEAF", "#AF6EC7", "#A5ADEE", "#F0A0BB", "#7EE0CE", "#C89ED8"];
const ENGAGEMENT_COLORS = { likes: "#EB6991", saves: "#AF6EC7", comments: "#4BCEAF", shares: "#7A86E0" };

// ─── Process gender+age demographics ─────────────────────────────────────────

function processGenderAge(
  data: Record<string, number>,
  labels: { male: string; female: string; other: string },
) {
  const genderTotals: Record<string, number> = {};
  const ageGroups: Record<string, number> = {};
  const ageByGender: Record<string, { hombre: number; mujer: number }> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("gender:")) {
      const raw = key.replace("gender:", "");
      const label = raw === "M" || raw.toLowerCase() === "male" ? labels.male : raw === "F" || raw.toLowerCase() === "female" ? labels.female : labels.other;
      genderTotals[label] = (genderTotals[label] || 0) + value;
      continue;
    }
    if (key.startsWith("age:")) {
      const range = key.replace("age:", "");
      ageGroups[range] = (ageGroups[range] || 0) + value;
      continue;
    }
    const [gender, ageRange] = key.split(".");
    if (!gender || !ageRange) continue;
    const label = gender === "M" ? labels.male : gender === "F" ? labels.female : labels.other;
    genderTotals[label] = (genderTotals[label] || 0) + value;
    ageGroups[ageRange] = (ageGroups[ageRange] || 0) + value;
    if (!ageByGender[ageRange]) ageByGender[ageRange] = { hombre: 0, mujer: 0 };
    if (gender === "M") ageByGender[ageRange].hombre += value;
    else if (gender === "F") ageByGender[ageRange].mujer += value;
  }

  const totalGender = Object.values(genderTotals).reduce((s, v) => s + v, 0) || 1;
  const genderPie = Object.entries(genderTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: ((value / totalGender) * 100).toFixed(1) }));

  const ageBars = Object.entries(ageGroups)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([range, value]) => ({ range, value }));

  const ageGenderBars = Object.entries(ageByGender)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([range, v]) => ({ range, hombre: v.hombre, mujer: v.mujer }));

  return { genderPie, ageBars, ageGenderBars };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IGMetrics({ dailyInsights, demographics }: IGMetricsProps) {
  const t = useTranslations("igShell");
  const locale = useLocale();
  const numLocale = locale === "en" ? "en-US" : "es-AR";
  const chart = useChartTheme();
  if (dailyInsights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground">{t("metrics.empty.title")}</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          {t("metrics.empty.line1")}{" "}
          {t("metrics.empty.permissionsBefore")}{" "}
          <code className="text-xs bg-white/[0.06] px-1 py-0.5 rounded">instagram_basic</code> {t("metrics.empty.permissionsAnd")}{" "}
          <code className="text-xs bg-white/[0.06] px-1 py-0.5 rounded">instagram_manage_insights</code>.
        </p>
      </div>
    );
  }
  const DAYS_LABELS = t.raw("metrics.daysShort") as string[];
  const GENDER_LABELS = {
    male: t("metrics.gender.male"),
    female: t("metrics.gender.female"),
    other: t("metrics.gender.other"),
  };

  // ── Data preparation ────────────────────────────────────────────────────────

  // Fill missing days so the chart X-axis is continuous (no gaps).
  const rawSorted = [...dailyInsights].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  const emptyDay: Omit<DayInsight, "metric_date"> = {
    impressions: 0, reach: 0, profile_views: 0, accounts_engaged: 0,
    total_interactions: 0, likes: 0, comments: 0, shares: 0, saves: 0,
    follower_count: 0, followers_total: 0, follows_count: 0, media_count: 0,
  };
  const sorted: DayInsight[] = [];
  if (rawSorted.length > 0) {
    const dateSet = new Set(rawSorted.map((d) => d.metric_date));
    const start = new Date(rawSorted[0].metric_date + "T00:00:00Z");
    const end = new Date(rawSorted[rawSorted.length - 1].metric_date + "T00:00:00Z");
    for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
      const key = dt.toISOString().split("T")[0];
      if (dateSet.has(key)) {
        sorted.push(rawSorted.find((d) => d.metric_date === key)!);
      } else {
        sorted.push({ metric_date: key, ...emptyDay });
      }
    }
  }

  // Follower curve: only use days that have a real followers_total snapshot (> 0).
  // This builds forward from the day the account was connected.
  const daysWithFollowers = sorted.filter((d) => d.followers_total > 0);
  const firstFt = daysWithFollowers[0]?.followers_total ?? 0;
  const lastFt = daysWithFollowers[daysWithFollowers.length - 1]?.followers_total ?? 0;
  const totalFollowersGainedFromSnapshots = lastFt - firstFt;

  const followerCurveData = daysWithFollowers.map((d) => ({
    date: formatDate(d.metric_date, locale),
    total: d.followers_total,
  }));

  const chartData = sorted.map((d) => ({
    date: formatDate(d.metric_date, locale),
    impressions: d.impressions,
    reach: d.reach,
    profile_views: d.profile_views,
    likes: d.likes,
    saves: d.saves,
    comments: d.comments,
    shares: d.shares,
  }));

  const engagementData = chartData.map((d) => ({
    date: d.date,
    [t("common.likes")]: d.likes,
    [t("common.saves")]: d.saves,
    [t("common.comments")]: d.comments,
    [t("common.shares")]: d.shares,
  }));

  // Day of week aggregation
  const dowAccum: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  sorted.forEach((d) => {
    const [year, month, day] = d.metric_date.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const dow = date.getUTCDay();
    dowAccum[dow].sum += d.total_interactions;
    dowAccum[dow].count += 1;
  });
  const dayOfWeekData = DAYS_LABELS.map((label, i) => ({
    day: label,
    avg: dowAccum[i].count > 0 ? Math.round(dowAccum[i].sum / dowAccum[i].count) : 0,
  }));
  const bestDay = dayOfWeekData.reduce((max, d) => (d.avg > max.avg ? d : max), dayOfWeekData[0]);

  // ── KPI aggregates ──────────────────────────────────────────────────────────

  const totalImpressions = sorted.reduce((s, d) => s + d.impressions, 0);
  const totalReach = sorted.reduce((s, d) => s + d.reach, 0);
  const totalInteractions = sorted.reduce((s, d) => s + d.total_interactions, 0);
  const totalLikes = sorted.reduce((s, d) => s + d.likes, 0);
  const totalComments = sorted.reduce((s, d) => s + d.comments, 0);
  const totalSaves = sorted.reduce((s, d) => s + d.saves, 0);
  const totalShares = sorted.reduce((s, d) => s + d.shares, 0);
  const totalProfileViews = sorted.reduce((s, d) => s + d.profile_views, 0);
  const totalFollowersGained = totalFollowersGainedFromSnapshots;
  const avgReach = sorted.length > 0 ? Math.round(totalReach / sorted.length) : 0;
  const avgFollowersGained = daysWithFollowers.length > 1 ? Math.round(totalFollowersGained / (daysWithFollowers.length - 1)) : 0;
  const engagementRate = totalImpressions > 0 ? ((totalInteractions / totalImpressions) * 100).toFixed(2) : "0";
  const savesRate = totalReach > 0 ? ((totalSaves / totalReach) * 100).toFixed(2) : "0";
  const profileConvRate = totalProfileViews > 0 && totalFollowersGained > 0 ? ((totalFollowersGained / totalProfileViews) * 100).toFixed(1) : "—";
  const lastDay = sorted[sorted.length - 1];

  // Trends: first half vs second half
  const impTrend = trendPct(sorted.map((d) => d.impressions));
  const reachTrend = trendPct(sorted.map((d) => d.reach));
  const intTrend = trendPct(sorted.map((d) => d.total_interactions));

  // Engagement composition
  const engagementItems = [
    { name: t("common.likes"), value: totalLikes, color: ENGAGEMENT_COLORS.likes, icon: Heart },
    { name: t("common.saves"), value: totalSaves, color: ENGAGEMENT_COLORS.saves, icon: Bookmark },
    { name: t("common.comments"), value: totalComments, color: ENGAGEMENT_COLORS.comments, icon: MessageSquare },
    { name: t("common.shares"), value: totalShares, color: ENGAGEMENT_COLORS.shares, icon: Share2 },
  ].filter((d) => d.value > 0);
  const totalEngPie = engagementItems.reduce((s, d) => s + d.value, 0) || 1;

  // X-axis tick interval
  const xInterval = Math.max(0, Math.floor(chartData.length / 7) - 1);

  // ── Demographics ────────────────────────────────────────────────────────────

  const genderData = demographics?.audience_gender_age
    ? processGenderAge(demographics.audience_gender_age, GENDER_LABELS)
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
  const maxCity = cityData ? Math.max(...cityData.map(([, v]) => v)) : 1;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Hero KPIs ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: t("metrics.kpis.totalImpressions"), value: fmt(totalImpressions), trend: impTrend, icon: Eye },
          { label: t("metrics.kpis.avgReachPerDay"), value: fmt(avgReach), trend: reachTrend, icon: Users },
          { label: t("metrics.kpis.totalInteractions"), value: fmt(totalInteractions), trend: intTrend, icon: Activity },
        ].map((k) => (
          <div key={k.label} className="glass-card px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <p className="stat-label">{k.label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.08]">
                <k.icon className="h-[14px] w-[14px] text-white/60" />
              </div>
            </div>
            <CountUp value={k.value} className="stat-number-xl" />
            <div className="mt-2 flex items-center gap-1.5">
              <TrendBadge pct={k.trend.pct} up={k.trend.up} />
              <span className="text-[11px] text-white/25">{t("metrics.vsFirstHalf")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[
          { label: t("metrics.secondaryKpis.engagementRate.label"), value: `${engagementRate}%`, icon: Zap, desc: t("metrics.secondaryKpis.engagementRate.desc") },
          { label: t("metrics.secondaryKpis.savesRate.label"), value: `${savesRate}%`, icon: Bookmark, desc: t("metrics.secondaryKpis.savesRate.desc") },
          { label: t("metrics.secondaryKpis.profileConv.label"), value: `${profileConvRate}%`, icon: UserPlus, desc: t("metrics.secondaryKpis.profileConv.desc") },
          { label: t("metrics.secondaryKpis.profileVisits.label"), value: fmt(totalProfileViews), icon: Eye, desc: t("metrics.secondaryKpis.profileVisits.desc") },
          { label: t("metrics.secondaryKpis.contentPublished.label"), value: `${lastDay?.media_count ?? 0}`, icon: BarChart3, desc: t("metrics.secondaryKpis.contentPublished.desc") },
        ].map((s) => (
          <div key={s.label} className="glass-card px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <s.icon className="h-3.5 w-3.5 shrink-0 text-white/50" />
              <p className="stat-label leading-tight">{s.label}</p>
            </div>
            <CountUp value={s.value} className="text-[22px] font-light tracking-tight text-white leading-none" />
            <p className="mt-1.5 text-[10px] text-white/25">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Alcance & Visibilidad — full width ── */}
      <Section title={t("metrics.reach.title")} subtitle={t("metrics.reach.subtitle", { days: sorted.length })}>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="m-imp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7A86E0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="m-reach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4BCEAF" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#4BCEAF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="m-pv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4BCEAF" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#4BCEAF" stopOpacity={0} />
                </linearGradient>
                <filter id="m-glow-v" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feFlood floodColor="#7A86E0" floodOpacity="0.7" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="m-glow-c" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feFlood floodColor="#4BCEAF" floodOpacity="0.7" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="m-glow-e" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feFlood floodColor="#4BCEAF" floodOpacity="0.7" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="m-dot">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} interval={xInterval} />
              <YAxis tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} width={48} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursorFill }} />
              <Area type="monotone" dataKey="impressions" name={t("common.impressions")} stroke="#7A86E0" fill="url(#m-imp)" strokeWidth={2.5} dot={false} animationDuration={1200} animationEasing="ease-out" style={{ filter: "url(#m-glow-v)" }} activeDot={{ r: 5, fill: "#7A86E0", stroke: "#c4b5fd", strokeWidth: 2, filter: "url(#m-dot)" }} />
              <Area type="monotone" dataKey="reach" name={t("common.reach")} stroke="#4BCEAF" fill="url(#m-reach)" strokeWidth={2.5} dot={false} animationDuration={1400} animationEasing="ease-out" style={{ filter: "url(#m-glow-c)" }} activeDot={{ r: 5, fill: "#4BCEAF", stroke: "#67e8f9", strokeWidth: 2, filter: "url(#m-dot)" }} />
              <Area type="monotone" dataKey="profile_views" name={t("metrics.reach.profileVisits")} stroke="#4BCEAF" fill="url(#m-pv)" strokeWidth={2} dot={false} animationDuration={1600} animationEasing="ease-out" style={{ filter: "url(#m-glow-e)" }} activeDot={{ r: 4, fill: "#4BCEAF", stroke: "#6ee7b7", strokeWidth: 2, filter: "url(#m-dot)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-4 flex-wrap">
          {[
            { color: "#7A86E0", label: t("common.impressions") },
            { color: "#4BCEAF", label: t("common.reach") },
            { color: "#4BCEAF", label: t("metrics.secondaryKpis.profileVisits.label") },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <div className="h-0.5 w-5 rounded-full" style={{ backgroundColor: l.color, boxShadow: `0 0 6px ${l.color}` }} />
              <span className="text-[11px] text-white/35">{l.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Radiografía del Engagement ── */}
      <Section title={t("metrics.engagement.title")} subtitle={t("metrics.engagement.subtitle")}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">

          {/* Stacked BarChart — daily breakdown */}
          <div>
            <p className="text-[11px] text-white/30 mb-4 uppercase tracking-[0.08em] font-medium">{t("metrics.engagement.dailyBreakdown")}</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} interval={xInterval} />
                  <YAxis tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursorFill }} />
                  <Bar dataKey={t("common.likes")} stackId="a" fill={ENGAGEMENT_COLORS.likes} radius={[0, 0, 0, 0]} animationDuration={900} />
                  <Bar dataKey={t("common.saves")} stackId="a" fill={ENGAGEMENT_COLORS.saves} radius={[0, 0, 0, 0]} animationDuration={1000} />
                  <Bar dataKey={t("common.comments")} stackId="a" fill={ENGAGEMENT_COLORS.comments} radius={[0, 0, 0, 0]} animationDuration={1100} />
                  <Bar dataKey={t("common.shares")} stackId="a" fill={ENGAGEMENT_COLORS.shares} radius={[4, 4, 0, 0]} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center flex-wrap gap-4 mt-4">
              {Object.entries(ENGAGEMENT_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[11px] text-white/35 capitalize">
                    {key === "likes" ? t("common.likes") : key === "saves" ? t("common.saves") : key === "comments" ? t("common.comments") : t("common.shares")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement composition — donut + progress bars */}
          <div>
            <p className="text-[11px] text-white/30 mb-4 uppercase tracking-[0.08em] font-medium">{t("metrics.engagement.composition")}</p>
            <div className="flex items-center gap-5 mb-5">
              {/* Donut */}
              <div className="h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <filter id="eng-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <Pie
                      data={engagementItems}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={3}
                      strokeWidth={0}
                      animationDuration={1200}
                      style={{ filter: "url(#eng-glow)" }}
                    >
                      {engagementItems.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} position={{ x: 0, y: -38 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Progress bars */}
              <div className="space-y-3 flex-1 min-w-0">
                {engagementItems.map((e) => (
                  <div key={e.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <e.icon className="h-3 w-3" style={{ color: e.color }} />
                        <span className="text-[12px] text-white/50">{e.name}</span>
                      </div>
                      <span className="text-[13px] font-light text-white">{((e.value / totalEngPie) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden bg-white/[0.05]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(e.value / totalEngPie) * 100}%`, backgroundColor: e.color, boxShadow: `0 0 8px ${e.color}` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic insight card */}
            {totalSaves > 0 && totalComments > 0 && (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: totalSaves > totalComments ? "rgba(251,191,36,0.06)" : "rgba(52,211,153,0.06)",
                  border: `1px solid ${totalSaves > totalComments ? "rgba(251,191,36,0.14)" : "rgba(52,211,153,0.14)"}`,
                }}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] mb-1" style={{ color: totalSaves > totalComments ? "rgba(251,191,36,0.7)" : "rgba(52,211,153,0.7)" }}>
                  {t("metrics.engagement.insightLabel")}
                </p>
                {totalSaves > totalComments ? (
                  <p className="text-[11px] text-white/50 font-light">{t.rich("metrics.engagement.insightSaves", {
                    highlight: (chunks) => <span className="text-amber-300">{chunks}</span>,
                  })}</p>
                ) : (
                  <p className="text-[11px] text-white/50 font-light">{t.rich("metrics.engagement.insightComments", {
                    highlight: (chunks) => <span className="text-emerald-300">{chunks}</span>,
                  })}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── Comunidad & Crecimiento ── */}
      <Section title={t("metrics.community.title")} subtitle={t("metrics.community.subtitle")}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Follower growth curve */}
          <div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: t("metrics.community.newFollowers"), value: totalFollowersGained > 0 ? `+${fmt(totalFollowersGained)}` : (daysWithFollowers.length < 2 ? "—" : fmt(totalFollowersGained)) },
                { label: t("metrics.community.avgPerDay"), value: daysWithFollowers.length < 2 ? "—" : fmt(avgFollowersGained) },
                { label: t("metrics.community.currentTotal"), value: fmt(lastFt || lastDay?.followers_total || 0) },
              ].map((s) => (
                <div key={s.label} className="glass-card px-4 py-3 text-center">
                  <p className="stat-label mb-1.5">{s.label}</p>
                  <p className="text-[20px] font-light text-white">{s.value}</p>
                </div>
              ))}
            </div>
            {followerCurveData.length >= 2 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={followerCurveData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4BCEAF" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#4BCEAF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(followerCurveData.length / 7) - 1)} />
                    <YAxis tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} width={45} domain={["dataMin - 10", "dataMax + 10"]} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: chart.grid }} />
                    <Area type="monotone" dataKey="total" name={t("common.followers")} stroke="#4BCEAF" strokeWidth={2} fill="url(#followerGrad)" animationDuration={1200} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] w-full flex items-center justify-center">
                <p className="text-white/30 text-sm">{t("metrics.community.needTwoDays")}</p>
              </div>
            )}
          </div>

          {/* Day of week radar */}
          <div>
            <p className="text-[11px] text-white/30 mb-1 uppercase tracking-[0.08em] font-medium">{t("metrics.community.interactionsByDay")}</p>
            <p className="text-[11px] text-white/20 mb-4">{t("metrics.community.historicalAvg")}</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={dayOfWeekData} margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
                  <PolarGrid stroke={chart.grid} />
                  <PolarAngleAxis
                    dataKey="day"
                    tick={{ fill: chart.axisTick, fontSize: 12 }}
                  />
                  <Radar
                    name={t("metrics.community.interactions")}
                    dataKey="avg"
                    stroke="#7A86E0"
                    fill="#7A86E0"
                    fillOpacity={0.18}
                    strokeWidth={2}
                    animationDuration={1200}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursorFill }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.1)" }}
            >
              <p className="text-[10px] text-indigo-300/70 font-medium uppercase tracking-[0.08em] mb-1">{t("metrics.community.bestDayToPost")}</p>
              <p className="text-[12px] text-white/50 font-light">
                {t.rich("metrics.community.bestDayLine", {
                  day: bestDay.day,
                  avg: bestDay.avg.toLocaleString(numLocale),
                  dayHighlight: (chunks) => <span className="text-white">{chunks}</span>,
                  avgHighlight: (chunks) => <span className="text-indigo-300">{chunks}</span>,
                })}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Demografía ── */}
      {demographics && (genderData || countryData || cityData) && (
        <Section title={t("metrics.demographics.title")} subtitle={t("metrics.demographics.subtitle")}>
          <div className="space-y-6">

            {/* Row 1: Género + Edad por género */}
            {genderData && (genderData.genderPie.length > 0 || genderData.ageBars.length > 0) && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                {/* Género — donut + progress bars */}
                {genderData.genderPie.length > 0 && (
                  <div className="glass-card p-6">
                    <p className="stat-label mb-5">{t("metrics.demographics.gender")}</p>
                    <div className="flex items-center gap-8">
                      <div className="h-[160px] w-[160px] shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <defs>
                              <filter id="gender-glow" x="-30%" y="-30%" width="160%" height="160%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                              </filter>
                            </defs>
                            <Pie
                              data={genderData.genderPie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={72}
                              paddingAngle={3}
                              strokeWidth={0}
                              animationDuration={1200}
                              style={{ filter: "url(#gender-glow)" }}
                            >
                              {genderData.genderPie.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} position={{ x: 0, y: -38 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-4 flex-1">
                        {genderData.genderPie.map((g, i) => (
                          <div key={g.name}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-[13px] text-white/50">{g.name}</span>
                              </div>
                              <span className="text-[18px] font-light text-white">{g.pct}%</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/[0.05]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${g.pct}%`,
                                  backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                                  boxShadow: `0 0 8px ${PIE_COLORS[i % PIE_COLORS.length]}`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Edad — grouped by gender or simple bars */}
                {(genderData.ageGenderBars.length > 0 || genderData.ageBars.length > 0) && (
                  <div className="glass-card p-6">
                    <p className="stat-label mb-5">
                      {genderData.ageGenderBars.length > 0 ? t("metrics.demographics.ageByGender") : t("metrics.demographics.ageDistribution")}
                    </p>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {genderData.ageGenderBars.length > 0 ? (
                          <BarChart data={genderData.ageGenderBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                            <XAxis dataKey="range" tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} width={35} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursorFill }} />
                            <Bar dataKey="hombre" name={t("metrics.gender.male")} fill="#7A86E0" radius={[4, 4, 0, 0]} animationDuration={1200} />
                            <Bar dataKey="mujer" name={t("metrics.gender.female")} fill="#EB6991" radius={[4, 4, 0, 0]} animationDuration={1400} />
                          </BarChart>
                        ) : (
                          <BarChart data={genderData.ageBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                            <XAxis dataKey="range" tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} width={35} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursorFill }} />
                            <Bar dataKey="value" name={t("common.followers")} fill="#7A86E0" radius={[4, 4, 0, 0]} animationDuration={1200} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                    {genderData.ageGenderBars.length > 0 && (
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-[#7A86E0]" />
                          <span className="text-[11px] text-white/35">{t("metrics.gender.male")}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-[#EB6991]" />
                          <span className="text-[11px] text-white/35">{t("metrics.gender.female")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Row 2: Países + Ciudades */}
            {(countryData?.length || cityData?.length) ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                {/* Countries — horizontal BarChart */}
                {countryData && countryData.length > 0 && (
                  <div className="glass-card p-6">
                    <p className="stat-label mb-5">{t("metrics.demographics.followersByCountry")}</p>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={countryData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: chart.axisTick }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: chart.axisTick }} tickLine={false} axisLine={false} width={90} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursorFill }} />
                          <Bar dataKey="value" name={t("common.followers")} radius={[0, 5, 5, 0]} animationDuration={1200}>
                            {countryData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Cities — visual ranked list with glow bars */}
                {cityData && cityData.length > 0 && (
                  <div className="glass-card p-6">
                    <p className="stat-label mb-5">{t("metrics.demographics.followersByCity")}</p>
                    <div className="space-y-3">
                      {cityData.map(([city, count], i) => (
                        <div key={city}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-white/20 w-4 text-right font-mono">{i + 1}</span>
                              <MapPin className="h-3 w-3 shrink-0" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-[13px] text-white/60 truncate max-w-[130px]">{city}</span>
                            </div>
                            <span className="text-[14px] font-light text-white">{count.toLocaleString(numLocale)}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/[0.04]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((count / maxCity) * 88)}%`,
                                backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                                boxShadow: `0 0 6px ${PIE_COLORS[i % PIE_COLORS.length]}60`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </Section>
      )}
    </div>
  );
}
