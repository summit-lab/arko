import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, User, Wifi, Cpu, DollarSign, Zap, Calendar, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { AdnDetailPanel } from "./AdnDetailPanel";
import { ClientLanguagePicker } from "./ClientLanguagePicker";
import { isLocale, type Locale } from "@/i18n/config";

interface UsageRow {
  id: string;
  feature: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number | null;
  created_at: string;
}

interface IntegrationRow {
  id: string;
  feature: string;
  provider: string;
  operation: string;
  items_count: number;
  cost_usd: number;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

interface MonthlyUsage {
  month: string;
  calls: number;
  tokens: number;
  cost: number;
}

const CALLS_PER_PAGE = 30;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const supabase = await createClient();
  const t = await getTranslations("adminDeep");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";

  // Fetch workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name, slug, is_active, created_at, owner_id, onboarding_completed")
    .eq("id", id)
    .single();

  if (!workspace) {
    console.error("[admin/clients/[id]] Workspace not found:", id, wsError);
    return notFound();
  }

  // Parallel fetches
  const [
    { data: metaConnections },
    { data: profile },
    profileRes, strategiesRes, marketRes, competitorsRes, brandRes, referencesRes,
    { data: usageRows },
    { data: integrationRows },
  ] = await Promise.all([
    supabase.from("meta_connections").select("status, ig_username, page_name, created_at").eq("workspace_id", id).limit(1),
    supabase.from("profiles").select("id, email, full_name, role, created_at, language").eq("id", workspace.owner_id).single(),
    supabase.from("workspace_profile").select("business_description, brand_persona, avatar_description, target_audience, main_offer").eq("workspace_id", id).maybeSingle(),
    supabase.from("workspace_strategies").select("platform, what_tested, test_results, conclusions, current_strategy, formats_and_quantity, why_it_will_work").eq("workspace_id", id),
    supabase.from("workspace_market").select("industry_state, audience_exposure, market_beliefs, burned_topics, current_trends, competitiveness, differentiator").eq("workspace_id", id).maybeSingle(),
    supabase.from("workspace_competitors").select("name, ig_url, why_better").eq("workspace_id", id),
    supabase.from("workspace_brand").select("why_clients_choose, niche_language, niche_tools, filtering_words, new_mechanisms").eq("workspace_id", id).maybeSingle(),
    supabase.from("workspace_references").select("brand_name, brand_url, what_they_like").eq("workspace_id", id),
    supabase.from("llm_usage").select("*").eq("workspace_id", id).order("created_at", { ascending: false }).limit(500),
    supabase.from("integration_usage").select("id, feature, provider, operation, items_count, cost_usd, latency_ms, status, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(500),
  ]);

  const connection = metaConnections?.[0] ?? null;

  const adnSections = [
    { key: "profile" as const, done: !!profileRes.data?.main_offer },
    { key: "strategies" as const, done: (strategiesRes.data?.length ?? 0) > 0 },
    { key: "market" as const, done: !!marketRes.data?.industry_state },
    { key: "competitors" as const, done: (competitorsRes.data?.length ?? 0) > 0 },
    { key: "brand" as const, done: !!brandRes.data?.why_clients_choose },
    { key: "references" as const, done: (referencesRes.data?.length ?? 0) > 0 },
  ];

  const adnData = {
    profile: profileRes.data,
    strategies: strategiesRes.data ?? [],
    market: marketRes.data,
    competitors: competitorsRes.data ?? [],
    brand: brandRes.data,
    references: referencesRes.data ?? [],
  };

  const rows = (usageRows ?? []) as UsageRow[];
  const totalTokens = rows.reduce((s, r) => s + r.total_tokens, 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const totalCalls = rows.length;

  // Integration usage
  const intRows = (integrationRows ?? []) as IntegrationRow[];
  const intTotalCalls = intRows.length;
  const intTotalCost = intRows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const intSuccessCount = intRows.filter((r) => r.status === "success").length;

  // Combined cost
  const combinedCost = totalCost + intTotalCost;

  // Monthly breakdown (IA + Integraciones combinado)
  const monthMap = new Map<string, MonthlyUsage>();
  for (const r of rows) {
    const date = new Date(r.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.calls += 1;
      existing.tokens += r.total_tokens;
      existing.cost += Number(r.cost_usd);
    } else {
      monthMap.set(key, { month: key, calls: 1, tokens: r.total_tokens, cost: Number(r.cost_usd) });
    }
  }
  for (const r of intRows) {
    const date = new Date(r.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.calls += 1;
      existing.cost += Number(r.cost_usd);
    } else {
      monthMap.set(key, { month: key, calls: 1, tokens: 0, cost: Number(r.cost_usd) });
    }
  }
  const monthlyUsage = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));

  // By type breakdown (LLM models + integrations combined)
  const typeMap = new Map<string, { label: string; calls: number; tokens: number; cost: number }>();
  for (const r of rows) {
    const existing = typeMap.get(r.model);
    if (existing) {
      existing.calls += 1;
      existing.tokens += r.total_tokens;
      existing.cost += Number(r.cost_usd);
    } else {
      typeMap.set(r.model, { label: r.model, calls: 1, tokens: r.total_tokens, cost: Number(r.cost_usd) });
    }
  }
  for (const r of intRows) {
    const key = `integ:${r.operation}`;
    const existing = typeMap.get(key);
    if (existing) {
      existing.calls += 1;
      existing.cost += Number(r.cost_usd);
    } else {
      typeMap.set(key, { label: r.operation, calls: 1, tokens: 0, cost: Number(r.cost_usd) });
    }
  }
  const typeUsage = Array.from(typeMap.values()).sort((a, b) => b.cost - a.cost);

  // Paginated calls
  const totalPages = Math.max(1, Math.ceil(rows.length / CALLS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCalls = rows.slice((safePage - 1) * CALLS_PER_PAGE, safePage * CALLS_PER_PAGE);

  return (
    <div className="px-8 py-10 space-y-6">
      {/* Back + Title */}
      <div>
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft size={14} />
          {t("client.backToClients")}
        </Link>
        <div className="flex items-center gap-4 mt-3">
          <h1 className="text-[28px] font-extralight tracking-[-0.02em] text-white/90">{workspace.name}</h1>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${workspace.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-[11px] text-white/40 font-light">{workspace.is_active ? t("client.active") : t("client.inactive")}</span>
          </div>
        </div>
        <p className="text-white/35 mt-1 text-[13px] font-light">
          {t("client.slugCreated", {
            slug: workspace.slug,
            date: new Date(workspace.created_at).toLocaleDateString(dateLocale, { day: "2-digit", month: "long", year: "numeric" }),
          })}
        </p>
      </div>

      {/* ═══ Two-column layout ═══ */}
      <div className="flex gap-6">
        {/* ── LEFT: Usage data (wider) ── */}
        <div className="flex-[3] min-w-0 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="glass-card px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-emerald-400" />
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">{t("client.totalCost")}</p>
              </div>
              <p className="text-[22px] font-light text-emerald-400/90 tracking-tight">
                ${combinedCost.toFixed(4)}
              </p>
              <p className="text-[10px] text-white/20 mt-1">
                {t("client.costSplit", { ai: totalCost.toFixed(4), integ: intTotalCost.toFixed(4) })}
              </p>
            </div>
            <div className="glass-card px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-blue-400" />
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">{t("client.aiCalls")}</p>
              </div>
              <p className="text-[22px] font-light text-blue-400/90 tracking-tight">
                {totalCalls}
              </p>
              <p className="text-[10px] text-white/20 mt-1">
                {t("client.tokensCount", { count: formatNumber(totalTokens) })}
              </p>
            </div>
            <div className="glass-card px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={14} className="text-amber-400" />
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">{t("client.integrations")}</p>
              </div>
              <p className="text-[22px] font-light text-amber-400/90 tracking-tight">
                {intTotalCalls}
              </p>
              <p className="text-[10px] text-white/20 mt-1">
                {t("client.integSummary", { cost: intTotalCost.toFixed(4), ok: intSuccessCount, err: intTotalCalls - intSuccessCount })}
              </p>
            </div>
            <div className="glass-card px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={14} className="text-violet-400" />
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">{t("client.types")}</p>
              </div>
              <p className="text-[22px] font-light text-violet-400/90 tracking-tight">
                {typeUsage.length}
              </p>
              <p className="text-[10px] text-white/20 mt-1">
                {typeUsage[0]?.label?.split("-").slice(0, 2).join("-") ?? "—"}
              </p>
            </div>
          </div>

          {/* Usage tables side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Monthly */}
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={14} className="text-amber-400" />
                <h3 className="text-[14px] font-light text-white tracking-wide">{t("client.usageByMonth")}</h3>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-2.5 border-b border-white/[0.06] px-2">
                  <div className="col-span-4">{t("client.month")}</div>
                  <div className="col-span-2 text-right">{t("client.calls")}</div>
                  <div className="col-span-3 text-right">{t("client.tokens")}</div>
                  <div className="col-span-3 text-right">{t("client.cost")}</div>
                </div>
                {monthlyUsage.length === 0 && (
                  <p className="text-white/25 text-[12px] py-3 text-center">{t("client.noUsage")}</p>
                )}
                {monthlyUsage.map((m) => (
                  <div key={m.month} className="grid grid-cols-12 gap-2 items-center py-2 rounded-lg hover:bg-white/[0.03] transition-all px-2">
                    <div className="col-span-4 text-[12px] font-light text-white/60">{formatMonth(m.month, locale)}</div>
                    <div className="col-span-2 text-right text-[12px] font-light text-white/40">{m.calls}</div>
                    <div className="col-span-3 text-right text-[12px] font-light text-white/40">{formatNumber(m.tokens)}</div>
                    <div className="col-span-3 text-right text-[12px] font-medium text-emerald-400/80">${m.cost.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Type */}
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={14} className="text-violet-400" />
                <h3 className="text-[14px] font-light text-white tracking-wide">{t("client.usageByType")}</h3>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-2.5 border-b border-white/[0.06] px-2">
                  <div className="col-span-5">{t("client.type")}</div>
                  <div className="col-span-2 text-right">{t("client.calls")}</div>
                  <div className="col-span-2 text-right">{t("client.tokens")}</div>
                  <div className="col-span-3 text-right">{t("client.cost")}</div>
                </div>
                {typeUsage.length === 0 && (
                  <p className="text-white/25 text-[12px] py-3 text-center">{t("client.noUsage")}</p>
                )}
                {typeUsage.map((m) => (
                  <div key={m.label} className="grid grid-cols-12 gap-2 items-center py-2 rounded-lg hover:bg-white/[0.03] transition-all px-2">
                    <div className="col-span-5 text-[11px] font-light text-white/60 truncate">{m.label}</div>
                    <div className="col-span-2 text-right text-[12px] font-light text-white/40">{m.calls}</div>
                    <div className="col-span-2 text-right text-[12px] font-light text-white/40">{m.tokens > 0 ? formatNumber(m.tokens) : "—"}</div>
                    <div className="col-span-3 text-right text-[12px] font-medium text-emerald-400/80">${m.cost.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Calls — Paginated */}
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-blue-400" />
                <h3 className="text-[14px] font-light text-white tracking-wide">{t("client.recentCalls")}</h3>
                <span className="text-[11px] text-white/20 font-light ml-1">({totalCalls})</span>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/25 font-light">
                    {safePage}/{totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    {safePage > 1 ? (
                      <Link
                        href={`/admin/clients/${id}?page=${safePage - 1}`}
                        className="h-7 w-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft size={14} className="text-white/40" />
                      </Link>
                    ) : (
                      <span className="h-7 w-7 rounded-lg bg-white/[0.02] flex items-center justify-center opacity-30">
                        <ChevronLeft size={14} className="text-white/20" />
                      </span>
                    )}
                    {safePage < totalPages ? (
                      <Link
                        href={`/admin/clients/${id}?page=${safePage + 1}`}
                        className="h-7 w-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                      >
                        <ChevronRight size={14} className="text-white/40" />
                      </Link>
                    ) : (
                      <span className="h-7 w-7 rounded-lg bg-white/[0.02] flex items-center justify-center opacity-30">
                        <ChevronRight size={14} className="text-white/20" />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-2.5 border-b border-white/[0.06] px-2">
                <div className="col-span-2">{t("client.feature")}</div>
                <div className="col-span-3">{t("client.model")}</div>
                <div className="col-span-2 text-right">{t("client.input")}</div>
                <div className="col-span-2 text-right">{t("client.output")}</div>
                <div className="col-span-1 text-right">{t("client.cost")}</div>
                <div className="col-span-2 text-right">{t("client.date")}</div>
              </div>
              {paginatedCalls.length === 0 && (
                <p className="text-white/25 text-[12px] py-3 text-center">{t("client.noCallsYet")}</p>
              )}
              {paginatedCalls.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-2 items-center py-2 rounded-lg hover:bg-white/[0.03] transition-all px-2">
                  <div className="col-span-2">
                    <span className="pill-badge">{r.feature}</span>
                  </div>
                  <div className="col-span-3 text-[11px] font-light text-white/50 truncate">{r.model}</div>
                  <div className="col-span-2 text-right text-[12px] font-light text-white/40">{formatNumber(r.input_tokens)}</div>
                  <div className="col-span-2 text-right text-[12px] font-light text-white/40">{formatNumber(r.output_tokens)}</div>
                  <div className="col-span-1 text-right text-[12px] font-medium text-emerald-400/70">${Number(r.cost_usd).toFixed(4)}</div>
                  <div className="col-span-2 text-right text-[11px] text-white/25">
                    {new Date(r.created_at).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })}{" "}
                    {new Date(r.created_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Recent Integrations */}
          {intRows.length > 0 && (
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={14} className="text-amber-400" />
                <h3 className="text-[14px] font-light text-white tracking-wide">{t("client.recentIntegrations")}</h3>
                <span className="text-[11px] text-white/20 font-light ml-1">({intTotalCalls})</span>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-2.5 border-b border-white/[0.06] px-2">
                  <div className="col-span-3">{t("client.feature")}</div>
                  <div className="col-span-2">{t("client.operation")}</div>
                  <div className="col-span-1 text-right">{t("client.items")}</div>
                  <div className="col-span-2 text-right">{t("client.cost")}</div>
                  <div className="col-span-1 text-center">{t("client.status")}</div>
                  <div className="col-span-3 text-right">{t("client.date")}</div>
                </div>
                {intRows.slice(0, 30).map((r) => (
                  <div key={r.id} className="grid grid-cols-12 gap-2 items-center py-2 rounded-lg hover:bg-white/[0.03] transition-all px-2">
                    <div className="col-span-3">
                      <span className="pill-badge">{r.feature}</span>
                    </div>
                    <div className="col-span-2 text-[11px] font-light text-white/50 truncate">{r.operation}</div>
                    <div className="col-span-1 text-right text-[12px] font-light text-white/40">{r.items_count}</div>
                    <div className="col-span-2 text-right text-[12px] font-medium text-emerald-400/70">${Number(r.cost_usd).toFixed(4)}</div>
                    <div className="col-span-1 text-center">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${r.status === "success" ? "bg-emerald-400" : "bg-red-400"}`} />
                    </div>
                    <div className="col-span-3 text-right text-[11px] text-white/25">
                      {new Date(r.created_at).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })}{" "}
                      {new Date(r.created_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Profile info + ADN (narrower, sticky) ── */}
        <div className="flex-[2] min-w-[320px] max-w-[420px] space-y-5">
          <div className="sticky top-6 space-y-5">
            {/* Owner card */}
            <div className="glass-card px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <User size={14} className="text-blue-400" />
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">{t("client.owner")}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-light text-white/70">{profile?.full_name ?? "—"}</p>
                {profile?.role === "admin" && (
                  <span className="text-[9px] font-medium text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">{t("client.adminBadge")}</span>
                )}
              </div>
              <p className="text-[11px] text-white/30 mt-0.5">{profile?.email ?? "—"}</p>
              <p className="text-[10px] text-white/20 mt-1">
                {t("client.registered", {
                  date: profile ? new Date(profile.created_at).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" }) : "—",
                })}
              </p>
              {profile?.id && (
                <ClientLanguagePicker
                  userId={profile.id}
                  initialLanguage={(isLocale(profile.language) ? profile.language : "es") as Locale}
                />
              )}
            </div>

            {/* Meta connection */}
            <div className="glass-card px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Wifi size={14} className={connection?.status === "active" ? "text-emerald-400" : "text-white/20"} />
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">{t("client.metaConnection")}</p>
              </div>
              {connection?.status === "active" ? (
                <>
                  <p className="text-[13px] font-light text-emerald-400">@{connection.ig_username}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{connection.page_name ?? "—"}</p>
                  <p className="text-[10px] text-white/20 mt-1">
                    {t("client.connectedOn", {
                      date: new Date(connection.created_at).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" }),
                    })}
                  </p>
                </>
              ) : connection ? (
                <p className="text-[13px] font-light text-amber-400/60">
                  {connection.status === "expired" ? t("client.tokenExpired") : connection.status}
                </p>
              ) : (
                <p className="text-[13px] font-light text-white/25">{t("client.notConnected")}</p>
              )}
            </div>

            {/* ADN Panel */}
            <AdnDetailPanel sections={adnSections} data={adnData} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatMonth(key: string, locale: string): string {
  const [year, month] = key.split("-");
  const monthsEs = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = locale === "en" ? monthsEn : monthsEs;
  return `${months[parseInt(month) - 1]} ${year}`;
}
