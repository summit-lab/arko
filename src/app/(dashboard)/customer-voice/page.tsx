import {
  Briefcase, Target, Sparkles, Shield, Globe, Megaphone, Lightbulb,
  ThumbsUp, Flame, TrendingUp, Star, Eye,
  Swords, Instagram, Youtube, Fingerprint, Zap, Pencil,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { IGGoals } from "@/components/instagram/IGGoals";
import { getAdnData } from "@/services/adn-progress.service";
import Link from "next/link";
import { Suspense } from "react";
import { CustomerVoiceTabs } from "./CustomerVoiceTabs";
import { CompetitorPanel } from "./CompetitorPanel";
import { ContentCalendar, type CalendarReel, type CalendarPlanItem } from "./ContentCalendar";

// ─── Helpers ────────────────────────────────────────────────────────────────

function Field({
  icon: Icon,
  label,
  value,
  accent = "white",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  accent?: string;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 text-${accent}/30`} />
        <span className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
          {label}
        </span>
      </div>
      <p className="text-[13px] text-white/65 font-light leading-[1.7]">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex text-[11px] text-white/50 font-light px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
      {children}
    </span>
  );
}

// ─── Internal types ─────────────────────────────────────────────────────────

interface CompetitorReelAnalysis {
  hook_text: string | null;
  hook_type: string | null;
  content_type: string | null;
  topic_cluster: string | null;
  style_notes: string | null;
  narrative_structure: string | null;
  strengths: string | null;
  weaknesses: string | null;
  ai_summary: string | null;
  cta_type: string | null;
}

interface CompetitorReelRow {
  id: string;
  competitor_id: string;
  caption: string | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  transcript: string | null;
  competitor_reel_analysis: Record<string, unknown> | Record<string, unknown>[] | null;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function CustomerVoicePage({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string }> }) {
  const params = await searchParams;
  const activeTab = params.tab === "competencia" ? "competencia" : params.tab === "calendario" ? "calendario" : params.tab === "metas" ? "metas" : "adn";
  const currentMonth = params.month ?? new Date().toISOString().slice(0, 7);
  const t = await getTranslations("customerVoice");

  const workspaceId = await getWorkspaceId();
  let goals: { metric: string; target_value: number }[] = [];
  let adnData: Awaited<ReturnType<typeof getAdnData>> | null = null;
  const competitorReels: Record<string, { reels: CompetitorReelRow[]; count: number }> = {};
  const competitorMeta: Record<string, { scraped_data: Record<string, unknown> | null; last_scraped_at: string | null; analysis_status: string }> = {};

  if (workspaceId) {
    const supabase = await createClient();
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const [goalsRes, adn] = await Promise.all([
      supabase
        .from("workspace_goals")
        .select("metric, target_value")
        .eq("workspace_id", workspaceId)
        .eq("period_start", periodStart),
      getAdnData(supabase, workspaceId),
    ]);

    goals = goalsRes.data ?? [];
    adnData = adn;

    // Fetch competitor reels with analysis + competitor metadata
    if (adnData?.competitors && adnData.competitors.length > 0) {
      const competitorIds = adnData.competitors.map((c) => c.id);

      const [{ data: reels }, { data: competitorMetaRows }] = await Promise.all([
        supabase
          .from("competitor_reels")
          .select(`
            id, competitor_id, caption, views_count, likes_count, comments_count,
            shares_count, duration_seconds, published_at, transcript,
            competitor_reel_analysis (
              hook_text, hook_type, content_type, topic_cluster,
              style_notes, strengths, weaknesses, ai_summary, cta_type,
              narrative_structure
            )
          `)
          .in("competitor_id", competitorIds)
          .order("views_count", { ascending: false, nullsFirst: false })
          .limit(50),
        supabase
          .from("workspace_competitors")
          .select("id, scraped_data, last_scraped_at, analysis_status")
          .in("id", competitorIds),
      ]);

      // Index competitor metadata by ID
      for (const m of (competitorMetaRows ?? []) as Array<{ id: string; scraped_data: unknown; last_scraped_at: string | null; analysis_status: string }>) {
        competitorMeta[m.id] = {
          scraped_data: (m.scraped_data && typeof m.scraped_data === "object" && Object.keys(m.scraped_data as Record<string, unknown>).length > 0)
            ? m.scraped_data as Record<string, unknown>
            : null,
          last_scraped_at: m.last_scraped_at,
          analysis_status: m.analysis_status ?? "idle",
        };
      }

      for (const reel of (reels ?? []) as CompetitorReelRow[]) {
        const cid = reel.competitor_id;
        if (!competitorReels[cid]) {
          competitorReels[cid] = { reels: [], count: 0 };
        }
        competitorReels[cid].reels.push(reel);
        competitorReels[cid].count++;
      }
    }
  }

  // ─── Metas Insights Data (always fetch — instant tab switch) ─────────────

  let metasInsights = { totalViews: 0, totalFollowers: 0, totalLikes: 0, totalSaves: 0, totalReach: 0, engagementRate: 0 };

  // ─── Calendar Data (always fetch — instant tab switch) ─────────────────────

  let calendarReels: CalendarReel[] = [];
  let calendarPlanItems: CalendarPlanItem[] = [];

  if (workspaceId) {
    const supabase = await createClient();
    const now = new Date();
    const metasMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [monthYear, monthNum] = currentMonth.split("-").map(Number);
    const calMonthStart = `${currentMonth}-01`;
    const lastDay = new Date(monthYear, monthNum, 0).getDate();
    const calMonthEnd = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

    const [metasRes, reelsRes, planRes, benchmarkRes] = await Promise.all([
      supabase
        .from("ig_account_insights")
        .select("impressions, reach, likes, saves, total_interactions, followers_total, metric_date")
        .eq("workspace_id", workspaceId)
        .gte("metric_date", metasMonthStart)
        .lte("metric_date", yesterday)
        .order("metric_date", { ascending: true }),
      supabase
        .from("reels")
        .select(`
          id, published_at, caption, thumbnail_url, permalink,
          reel_metrics (views_org),
          reel_metrics_paid (views_paid)
        `)
        .eq("workspace_id", workspaceId)
        .eq("media_product_type", "REELS")
        .gte("published_at", calMonthStart)
        .lte("published_at", `${calMonthEnd}T23:59:59Z`)
        .order("published_at", { ascending: true }),
      supabase
        .from("content_plan")
        .select("id, planned_date, title, description, platform, content_type, status")
        .eq("workspace_id", workspaceId)
        .gte("planned_date", calMonthStart)
        .lte("planned_date", calMonthEnd)
        .order("planned_date", { ascending: true }),
      supabase
        .from("reel_benchmarks")
        .select("avg_views_90d")
        .eq("workspace_id", workspaceId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Process metas insights
    const monthInsights = metasRes.data;
    if (monthInsights && monthInsights.length > 0) {
      const totalViews = monthInsights.reduce((s, d) => s + (d.impressions ?? 0), 0);
      const totalReach = monthInsights.reduce((s, d) => s + (d.reach ?? 0), 0);
      const totalLikes = monthInsights.reduce((s, d) => s + (d.likes ?? 0), 0);
      const totalSaves = monthInsights.reduce((s, d) => s + (d.saves ?? 0), 0);
      const totalInteractions = monthInsights.reduce((s, d) => s + (d.total_interactions ?? 0), 0);
      // Query is ordered by metric_date ASC — .at(-1) is the most recent snapshot.
      // Treat null/0 as "missing" so downstream doesn't show "0 followers".
      const latestRow = monthInsights.at(-1);
      const latestFollowers = latestRow?.followers_total && latestRow.followers_total > 0
        ? latestRow.followers_total
        : 0;

      metasInsights = {
        totalViews,
        totalFollowers: latestFollowers,
        totalLikes,
        totalSaves,
        totalReach,
        engagementRate: totalReach > 0 ? Number(((totalInteractions / totalReach) * 100).toFixed(2)) : 0,
      };
    }

    // Process calendar reels
    const avgViews = benchmarkRes.data?.avg_views_90d || 1;
    if (reelsRes.data) {
      type MetricsShape = { views_org: number };
      type PaidShape = { views_paid: number };
      const getM = (raw: unknown): MetricsShape | null => Array.isArray(raw) ? (raw as MetricsShape[])[0] : (raw as MetricsShape | null);
      const getP = (raw: unknown): PaidShape | null => Array.isArray(raw) ? (raw as PaidShape[])[0] : (raw as PaidShape | null);

      calendarReels = reelsRes.data.map((r) => {
        const m = getM(r.reel_metrics);
        const p = getP(r.reel_metrics_paid);
        const viewsTotal = (m?.views_org || 0) + (p?.views_paid || 0);
        return {
          id: r.id,
          published_at: r.published_at ?? "",
          views_total: viewsTotal,
          caption: r.caption,
          performer_multiple: avgViews > 0 ? viewsTotal / avgViews : null,
          thumbnail_url: r.thumbnail_url ?? null,
          permalink: r.permalink ?? null,
        };
      }).filter((r) => r.published_at);
    }

    calendarPlanItems = (planRes.data ?? []) as CalendarPlanItem[];
  }

  // ─── ADN Data ───────────────────────────────────────────────────────────────

  const profile = adnData?.profile;
  const brand = adnData?.brand;
  const market = adnData?.market;
  const strategies = adnData?.strategies ?? [];
  const competitors = adnData?.competitors ?? [];
  const references = adnData?.references ?? [];
  const hasAdnData = !!(profile || brand || market);

  // Build competitor data for panel
  const competitorPanelData = competitors
    .filter((c): c is typeof c & { id: string } => c.id != null)
    .map((c) => {
      const cReels = competitorReels[c.id]?.reels ?? [];
      const meta = competitorMeta[c.id];
      return {
        id: c.id,
        name: c.name,
        ig_url: c.ig_url,
        why_better: c.why_better,
        scraped_data: meta?.scraped_data ?? null,
        last_scraped_at: meta?.last_scraped_at ?? null,
        analysis_status: meta?.analysis_status ?? "idle",
        reels: cReels.map((r: CompetitorReelRow) => ({
          id: r.id,
          caption: r.caption,
          views_count: r.views_count,
          likes_count: r.likes_count,
          comments_count: r.comments_count,
          shares_count: r.shares_count,
          duration_seconds: r.duration_seconds,
          published_at: r.published_at,
          transcript: r.transcript,
          competitor_reel_analysis: (Array.isArray(r.competitor_reel_analysis)
            ? r.competitor_reel_analysis[0] ?? null
            : r.competitor_reel_analysis ?? null) as CompetitorReelAnalysis | null,
        })),
        reels_count: competitorReels[c.id]?.count ?? 0,
      };
    });

  // ─── ADN Content ──────────────────────────────────────────────────────────

  const adnContent = !hasAdnData ? (
    <div className="glass-panel rounded-xl p-12 text-center animate-slide-up">
      <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
        <Fingerprint className="h-6 w-6 text-amber-400" />
      </div>
      <p className="text-[16px] text-white/60 font-light mb-1.5">
        {t("adnEmpty.title")}
      </p>
      <p className="text-[13px] text-white/30 font-light mb-6 max-w-md mx-auto">
        {t("adnEmpty.description")}
      </p>
      <Link
        href="/onboarding/adn"
        className="inline-flex text-[13px] font-medium text-amber-300 hover:text-amber-200 transition-colors px-5 py-2.5 rounded-xl bg-amber-500/[0.1] hover:bg-amber-500/[0.18] border border-amber-500/25"
      >
        {t("adnEmpty.cta")}
      </Link>
    </div>
  ) : (
    <div className="space-y-6">
      {/* ROW 1 — Identity + Persona */}
      <div className="flex gap-6 animate-slide-up">
        <div className="flex-[7] glass-panel rounded-xl p-7 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none opacity-[0.04]" style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }} />
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/10">
              <Fingerprint className="h-5 w-5 text-violet-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-[17px] font-medium text-white/90 tracking-wide">Identidad</h2>
              <p className="text-[11px] text-white/25 font-light">Quién sos y qué hacés</p>
            </div>
            <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
              <Pencil className="h-3 w-3" />Editar
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Field icon={Briefcase} label="Negocio" value={profile?.business_description} />
            <Field icon={Sparkles} label="Oferta Principal" value={profile?.main_offer} />
            <div className="col-span-2">
              <Field icon={Megaphone} label="Personalidad de Marca" value={profile?.brand_persona} />
            </div>
          </div>
        </div>
        <div className="flex-[3] glass-panel rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full pointer-events-none opacity-[0.04]" style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)" }} />
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium flex-1">Tu Avatar</span>
              <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
                <Pencil className="h-2.5 w-2.5" />Editar
              </Link>
            </div>
            <p className="text-[14px] text-white/75 font-light leading-[1.7] mb-4">{profile?.avatar_description || "—"}</p>
          </div>
          {profile?.target_audience && (
            <div className="pt-4 border-t border-white/[0.06]">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.12em] font-medium">Audiencia</span>
              <p className="text-[12px] text-white/50 font-light leading-[1.6] mt-1">{profile.target_audience}</p>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2 — Why + Differentiator + Mechanisms */}
      <div className="grid grid-cols-3 gap-6 animate-slide-up">
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none opacity-[0.05]" style={{ background: "radial-gradient(circle, #34d399 0%, transparent 70%)" }} />
          <div className="flex items-center gap-2 mb-4">
            <ThumbsUp className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium flex-1">Por qué te eligen</span>
            <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
              <Pencil className="h-2.5 w-2.5" />Editar
            </Link>
          </div>
          <p className="text-[14px] text-white/70 font-light leading-[1.7]">{brand?.why_clients_choose || "—"}</p>
        </div>
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden">
          <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full pointer-events-none opacity-[0.05]" style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)" }} />
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-amber-400" />
            <span className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium flex-1">Diferenciador</span>
            <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
              <Pencil className="h-2.5 w-2.5" />Editar
            </Link>
          </div>
          <p className="text-[14px] text-white/70 font-light leading-[1.7]">{market?.differentiator || "—"}</p>
        </div>
        <div className="glass-panel rounded-xl p-6 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full pointer-events-none opacity-[0.05]" style={{ background: "radial-gradient(circle, #c084fc 0%, transparent 70%)" }} />
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-purple-400" />
            <span className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium flex-1">Mecanismos Nuevos</span>
            <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
              <Pencil className="h-2.5 w-2.5" />Editar
            </Link>
          </div>
          <p className="text-[14px] text-white/70 font-light leading-[1.7]">{brand?.new_mechanisms || "—"}</p>
        </div>
      </div>

      {/* ROW 3 — Market + Niche DNA + Competitors mini */}
      <div className="flex gap-6 animate-slide-up">
        <div className="flex-[5] glass-panel rounded-xl p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10">
              <TrendingUp className="h-4.5 w-4.5 text-amber-400" />
            </div>
            <h3 className="text-[15px] font-medium text-white/85 tracking-wide flex-1">Mercado e Industria</h3>
            <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
              <Pencil className="h-3 w-3" />Editar
            </Link>
          </div>
          <div className="space-y-5">
            <Field icon={TrendingUp} label="Estado de la Industria" value={market?.industry_state} accent="amber" />
            <Field icon={Eye} label="Exposición del Avatar" value={market?.audience_exposure} accent="amber" />
            <Field icon={Eye} label="Creencias del Mercado" value={market?.market_beliefs} accent="amber" />
            <Field icon={Flame} label="Temas Quemados" value={market?.burned_topics} accent="amber" />
            <Field icon={Sparkles} label="Tendencias Actuales" value={market?.current_trends} accent="amber" />
            <Field icon={Swords} label="Competitividad" value={market?.competitiveness} accent="amber" />
          </div>
        </div>
        <div className="flex-[4] space-y-6">
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Globe className="h-4 w-4 text-cyan-400" />
              <h3 className="text-[14px] font-medium text-white/80 tracking-wide flex-1">ADN del Nicho</h3>
              <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
                <Pencil className="h-2.5 w-2.5" />Editar
              </Link>
            </div>
            {brand?.niche_language && (
              <div className="mb-4">
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em] font-medium block mb-2">Lenguaje</span>
                <div className="flex flex-wrap gap-1.5">{brand.niche_language.split(",").map((w, i) => <Tag key={i}>{w.trim()}</Tag>)}</div>
              </div>
            )}
            {brand?.niche_tools && (
              <div className="mb-4">
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em] font-medium block mb-2">Herramientas</span>
                <div className="flex flex-wrap gap-1.5">{brand.niche_tools.split(",").map((w, i) => <Tag key={i}>{w.trim()}</Tag>)}</div>
              </div>
            )}
            {brand?.filtering_words && (
              <div>
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em] font-medium block mb-2">Palabras Filtro</span>
                <div className="flex flex-wrap gap-1.5">{brand.filtering_words.split(",").map((w, i) => <Tag key={i}>{w.trim()}</Tag>)}</div>
              </div>
            )}
          </div>
          {competitors.length > 0 && (
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Swords className="h-4 w-4 text-rose-400" />
                  <h3 className="text-[14px] font-medium text-white/80 tracking-wide">Competidores</h3>
                </div>
                <span className="text-[11px] text-white/20 font-light">{competitors.length}</span>
              </div>
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                    <div className="h-7 w-7 rounded-full bg-rose-500/8 flex items-center justify-center shrink-0 border border-rose-500/10">
                      <span className="text-[11px] text-rose-400 font-medium">{(c.name ?? "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/70 font-medium truncate">{c.name}</p>
                      {c.ig_url && <p className="text-[10px] text-white/20 font-light truncate">{c.ig_url}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 4 — Strategies */}
      {strategies.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex gap-6">
            {strategies.map((s, i) => {
              const isIg = s.platform === "instagram";
              const color = isIg ? "pink" : "red";
              return (
                <div key={i} className="flex-1 glass-panel rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full pointer-events-none opacity-[0.03]" style={{ background: `radial-gradient(circle, ${isIg ? "#ec4899" : "#ef4444"} 0%, transparent 70%)` }} />
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className={`h-8 w-8 rounded-xl bg-${color}-500/10 flex items-center justify-center border border-${color}-500/10`}>
                      {isIg ? <Instagram className="h-4 w-4 text-pink-400" /> : <Youtube className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[14px] font-medium text-white/85 tracking-wide capitalize">{s.platform}</h3>
                      <p className="text-[10px] text-white/20 font-light">Estrategia de contenido</p>
                    </div>
                    <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
                      <Pencil className="h-2.5 w-2.5" />Editar
                    </Link>
                  </div>
                  <div className="space-y-4">
                    <Field icon={Eye} label="Qué probó" value={s.what_tested} />
                    <Field icon={TrendingUp} label="Resultados" value={s.test_results} />
                    <Field icon={Lightbulb} label="Conclusiones" value={s.conclusions} />
                    <Field icon={Target} label="Estrategia Actual" value={s.current_strategy} />
                    <Field icon={Zap} label="Formatos y Cantidad" value={s.formats_and_quantity} />
                    <Field icon={ThumbsUp} label="Por qué va a funcionar" value={s.why_it_will_work} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROW 5 — References */}
      {references.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-yellow-400" />
            <h3 className="text-[14px] font-medium text-white/80 tracking-wide flex-1">Marcas de Referencia</h3>
            <span className="text-[11px] text-white/20 font-light">({references.length})</span>
            <Link href="/onboarding/adn" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all ml-2">
              <Pencil className="h-2.5 w-2.5" />Editar
            </Link>
          </div>
          <div className="flex gap-4">
            {references.map((r, i) => (
              <div key={i} className="flex-1 min-w-0 glass-card px-5 py-4 rounded-xl hover:bg-white/[0.06] transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="h-8 w-8 rounded-full bg-yellow-500/8 flex items-center justify-center border border-yellow-500/10 shrink-0">
                    <Star className="h-3.5 w-3.5 text-yellow-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] text-white/80 font-medium truncate">{r.brand_name}</p>
                    {r.brand_url && <p className="text-[10px] text-white/20 font-light truncate">{r.brand_url}</p>}
                  </div>
                </div>
                {r.what_they_like && <p className="text-[12px] text-white/45 font-light leading-[1.6]">{r.what_they_like}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );

  // ─── Competitor Content ───────────────────────────────────────────────────

  const competitorContent = (
    <CompetitorPanel
      competitors={competitorPanelData}
      workspaceId={workspaceId ?? ""}
    />
  );

  // ─── Calendar Content ─────────────────────────────────────────────────────

  const calendarContent = (
    <ContentCalendar
      currentMonth={currentMonth}
      publishedReels={calendarReels}
      planItems={calendarPlanItems}
    />
  );

  // ─── Metas Content ──────────────────────────────────────────────────────

  const metasContent = (
    <IGGoals goals={goals} insights={metasInsights} />
  );

  return (
    <div className="px-8 py-10">
      {/* Header */}
      <div className="animate-slide-up mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{t("title")}</h1>
            <p className="text-white/35 mt-3 text-[15px] font-light">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/onboarding/adn"
            className="text-[12px] font-medium text-white/40 hover:text-white/70 transition-colors px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08]"
          >
            {t("editAdn")}
          </Link>
        </div>
      </div>

      <Suspense>
        <CustomerVoiceTabs
          initialTab={activeTab}
          adnContent={adnContent}
          competitorContent={competitorContent}
          calendarContent={calendarContent}
          metasContent={metasContent}
        />
      </Suspense>
    </div>
  );
}
