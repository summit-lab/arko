import { createClient } from "@/lib/supabase/server";
import { Cpu, DollarSign, Zap, TrendingUp, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { UsageDailyChart } from "./UsageDailyChart";

interface LLMRow {
  id: string;
  workspace_id: string;
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
  workspace_id: string;
  feature: string;
  provider: string;
  operation: string;
  items_count: number;
  cost_usd: number;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

/** Unified row for the "Últimas Operaciones" table */
interface UnifiedRow {
  id: string;
  kind: "llm" | "integration";
  feature: string;
  label: string;
  tokens: number;
  cost: number;
  created_at: string;
}

interface WorkspaceUsage {
  workspace_id: string;
  workspace_name: string | null;
  total_tokens: number;
  total_cost: number;
  call_count: number;
}

interface TypeUsage {
  label: string;
  provider: string;
  total_tokens: number;
  total_cost: number;
  call_count: number;
  avg_latency: number;
}

/** Human-readable feature labels */
const FEATURE_LABELS: Record<string, string> = {
  'ai-agents': 'Moka AI Chat',
  'onboarding-adn': 'Onboarding ADN',
  'competitor-analysis': 'Análisis Competidores (IA)',
  'competitor-scraping': 'Scraping Competidores',
  'arkoai-video-analysis': 'Análisis Video (Reels)',
  'reel-diagnostics': 'Diagnóstico Reels',
  'metrics-analysis': 'Análisis Métricas',
  'reel-scrape': 'Sync Reels (Meta)',
};

function getFeatureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

const CALLS_PER_PAGE = 30;

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const supabase = await createClient();

  // Fetch both tables in parallel
  const [{ data: llmRows }, { data: integrationRows }] = await Promise.all([
    supabase.from("llm_usage").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("integration_usage").select("*").order("created_at", { ascending: false }).limit(500),
  ]);

  const rows = (llmRows ?? []) as LLMRow[];
  const intRows = (integrationRows ?? []) as IntegrationRow[];

  // ── Aggregate totals ──
  const llmCost = rows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const intCost = intRows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const totalCost = llmCost + intCost;
  const totalTokens = rows.reduce((s, r) => s + r.total_tokens, 0);
  const totalOps = rows.length + intRows.length;

  const allLatencies = [
    ...rows.filter((r) => r.latency_ms).map((r) => r.latency_ms!),
    ...intRows.filter((r) => r.latency_ms).map((r) => r.latency_ms!),
  ];
  const avgLatency = allLatencies.length > 0
    ? Math.round(allLatencies.reduce((s, l) => s + l, 0) / allLatencies.length)
    : 0;

  // ── Aggregate by day (last 30 days) ──
  const dailyMap = new Map<string, { llm_cost: number; integration_cost: number; llm_calls: number; integration_calls: number }>();
  for (const r of rows) {
    const day = new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
    const existing = dailyMap.get(day);
    if (existing) {
      existing.llm_cost += Number(r.cost_usd);
      existing.llm_calls += 1;
    } else {
      dailyMap.set(day, { llm_cost: Number(r.cost_usd), integration_cost: 0, llm_calls: 1, integration_calls: 0 });
    }
  }
  for (const r of intRows) {
    const day = new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
    const existing = dailyMap.get(day);
    if (existing) {
      existing.integration_cost += Number(r.cost_usd);
      existing.integration_calls += 1;
    } else {
      dailyMap.set(day, { llm_cost: 0, integration_cost: Number(r.cost_usd), llm_calls: 0, integration_calls: 1 });
    }
  }
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .reverse()
    .slice(-30);

  // ── Aggregate by feature (for bar chart) ──
  const featureMap = new Map<string, { cost: number; calls: number }>();
  for (const r of rows) {
    const existing = featureMap.get(r.feature);
    if (existing) {
      existing.cost += Number(r.cost_usd);
      existing.calls += 1;
    } else {
      featureMap.set(r.feature, { cost: Number(r.cost_usd), calls: 1 });
    }
  }
  for (const r of intRows) {
    const existing = featureMap.get(r.feature);
    if (existing) {
      existing.cost += Number(r.cost_usd);
      existing.calls += 1;
    } else {
      featureMap.set(r.feature, { cost: Number(r.cost_usd), calls: 1 });
    }
  }
  const featureData = Array.from(featureMap.entries())
    .map(([feature, data]) => ({ feature, ...data }))
    .sort((a, b) => b.cost - a.cost);

  // ── Aggregate by type (LLM models + integration operations) ──
  const typeMap = new Map<string, TypeUsage>();
  for (const r of rows) {
    const existing = typeMap.get(r.model);
    if (existing) {
      existing.total_tokens += r.total_tokens;
      existing.total_cost += Number(r.cost_usd);
      existing.call_count += 1;
      existing.avg_latency += r.latency_ms ?? 0;
    } else {
      typeMap.set(r.model, {
        label: r.model,
        provider: r.provider,
        total_tokens: r.total_tokens,
        total_cost: Number(r.cost_usd),
        call_count: 1,
        avg_latency: r.latency_ms ?? 0,
      });
    }
  }
  for (const r of intRows) {
    const key = `integ:${r.operation}`;
    const existing = typeMap.get(key);
    if (existing) {
      existing.total_cost += Number(r.cost_usd);
      existing.call_count += 1;
      existing.avg_latency += r.latency_ms ?? 0;
    } else {
      typeMap.set(key, {
        label: r.operation,
        provider: r.provider,
        total_tokens: 0,
        total_cost: Number(r.cost_usd),
        call_count: 1,
        avg_latency: r.latency_ms ?? 0,
      });
    }
  }
  for (const m of typeMap.values()) {
    m.avg_latency = m.call_count > 0 ? Math.round(m.avg_latency / m.call_count) : 0;
  }
  const typeUsage = Array.from(typeMap.values()).sort((a, b) => b.total_cost - a.total_cost);

  // ── Aggregate by workspace ──
  const wsMap = new Map<string, WorkspaceUsage>();
  for (const r of rows) {
    const existing = wsMap.get(r.workspace_id);
    if (existing) {
      existing.total_tokens += r.total_tokens;
      existing.total_cost += Number(r.cost_usd);
      existing.call_count += 1;
    } else {
      wsMap.set(r.workspace_id, {
        workspace_id: r.workspace_id,
        workspace_name: null,
        total_tokens: r.total_tokens,
        total_cost: Number(r.cost_usd),
        call_count: 1,
      });
    }
  }
  for (const r of intRows) {
    const existing = wsMap.get(r.workspace_id);
    if (existing) {
      existing.total_cost += Number(r.cost_usd);
      existing.call_count += 1;
    } else {
      wsMap.set(r.workspace_id, {
        workspace_id: r.workspace_id,
        workspace_name: null,
        total_tokens: 0,
        total_cost: Number(r.cost_usd),
        call_count: 1,
      });
    }
  }

  if (wsMap.size > 0) {
    const { data: workspaces } = await supabase
      .from("workspaces")
      .select("id, name")
      .in("id", Array.from(wsMap.keys()));
    for (const ws of workspaces ?? []) {
      const entry = wsMap.get(ws.id);
      if (entry) entry.workspace_name = ws.name;
    }
  }
  const workspaceUsage = Array.from(wsMap.values()).sort((a, b) => b.total_cost - a.total_cost);

  // ── Unified timeline (LLM + integrations merged, sorted by date) ──
  const unified: UnifiedRow[] = [
    ...rows.map((r) => ({
      id: r.id,
      kind: "llm" as const,
      feature: r.feature,
      label: r.model,
      tokens: r.total_tokens,
      cost: Number(r.cost_usd),
      created_at: r.created_at,
    })),
    ...intRows.map((r) => ({
      id: r.id,
      kind: "integration" as const,
      feature: r.feature,
      label: r.operation,
      tokens: 0,
      cost: Number(r.cost_usd),
      created_at: r.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalPages = Math.max(1, Math.ceil(unified.length / CALLS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOps = unified.slice((safePage - 1) * CALLS_PER_PAGE, safePage * CALLS_PER_PAGE);

  const stats = [
    { label: "Costo Total", value: `$${totalCost.toFixed(4)}`, sub: `IA $${llmCost.toFixed(4)} · Integ. $${intCost.toFixed(4)}`, icon: DollarSign, color: "text-emerald-400" },
    { label: "Total Tokens", value: formatNumber(totalTokens), sub: `${rows.length} llamadas IA`, icon: Zap, color: "text-blue-400" },
    { label: "Operaciones", value: totalOps.toString(), sub: `${rows.length} IA · ${intRows.length} integ.`, icon: Cpu, color: "text-violet-400" },
    { label: "Latencia Prom.", value: `${avgLatency}ms`, sub: `${typeUsage.length} tipos distintos`, icon: TrendingUp, color: "text-amber-400" },
  ];

  return (
    <div className="px-8 py-10 space-y-8">
      <div>
        <h1 className="page-title">Usage</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">
          Monitoreo de consumo: modelos IA, integraciones externas y costos por sección.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-5">
        {stats.map((s, i) => (
          <div key={s.label} className={`glass-card px-6 py-5 animate-slide-up stagger-${i + 1}`}>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <p className="stat-label">{s.label}</p>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${s.color}`}
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <s.icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <p className="stat-number-xl relative z-10">{s.value}</p>
            <p className="text-[10px] text-white/20 mt-1 relative z-10">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts: Daily cost + Cost by feature */}
      <UsageDailyChart dailyData={dailyData} featureData={featureData} />

      {/* Two columns: Type breakdown + Workspace breakdown */}
      <div className="grid grid-cols-2 gap-6">
        {/* By Type */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-[15px] font-light text-white tracking-wide mb-5">
            Consumo por Modelo / Operación
          </h3>
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
              <div className="col-span-4">Tipo</div>
              <div className="col-span-2 text-right">Calls</div>
              <div className="col-span-3 text-right">Tokens</div>
              <div className="col-span-3 text-right">Costo</div>
            </div>
            {typeUsage.length === 0 && (
              <p className="text-white/25 text-[13px] py-4 text-center">Sin datos todavía.</p>
            )}
            {typeUsage.map((m) => (
              <div key={m.label} className="grid grid-cols-12 gap-2 items-center py-3 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2">
                <div className="col-span-4">
                  <p className="text-[12px] font-light text-white/70 truncate">{m.label}</p>
                  <p className="text-[10px] text-white/25">{m.provider} · {m.avg_latency}ms avg</p>
                </div>
                <div className="col-span-2 text-right text-[13px] font-light text-white/50">{m.call_count}</div>
                <div className="col-span-3 text-right text-[13px] font-light text-white/50">{m.total_tokens > 0 ? formatNumber(m.total_tokens) : "—"}</div>
                <div className="col-span-3 text-right">
                  <span className="text-[13px] font-medium text-emerald-400/80">${m.total_cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Workspace */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-[15px] font-light text-white tracking-wide mb-5">
            Consumo por Workspace
          </h3>
          <div className="space-y-1">
            <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
              <div className="col-span-4">Workspace</div>
              <div className="col-span-2 text-right">Ops</div>
              <div className="col-span-3 text-right">Tokens</div>
              <div className="col-span-3 text-right">Costo</div>
            </div>
            {workspaceUsage.length === 0 && (
              <p className="text-white/25 text-[13px] py-4 text-center">Sin datos todavía.</p>
            )}
            {workspaceUsage.map((w) => (
              <div key={w.workspace_id} className="grid grid-cols-12 gap-2 items-center py-3 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2">
                <div className="col-span-4 text-[12px] font-light text-white/70 truncate">
                  {w.workspace_name ?? w.workspace_id.slice(0, 8)}
                </div>
                <div className="col-span-2 text-right text-[13px] font-light text-white/50">{w.call_count}</div>
                <div className="col-span-3 text-right text-[13px] font-light text-white/50">{w.total_tokens > 0 ? formatNumber(w.total_tokens) : "—"}</div>
                <div className="col-span-3 text-right">
                  <span className="text-[13px] font-medium text-emerald-400/80">${w.total_cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified timeline */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-light text-white tracking-wide">
            Últimas Operaciones
            <span className="text-[11px] text-white/20 font-light ml-2">({unified.length})</span>
          </h3>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/25 font-light">{safePage}/{totalPages}</span>
              <div className="flex items-center gap-1">
                {safePage > 1 ? (
                  <Link
                    href={`/admin/usage?page=${safePage - 1}`}
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
                    href={`/admin/usage?page=${safePage + 1}`}
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
          <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
            <div className="col-span-1">Tipo</div>
            <div className="col-span-2">Sección</div>
            <div className="col-span-3">Modelo / Op.</div>
            <div className="col-span-2 text-right">Tokens</div>
            <div className="col-span-2 text-right">Costo</div>
            <div className="col-span-2 text-right">Fecha</div>
          </div>
          {paginatedOps.length === 0 && (
            <p className="text-white/25 text-[13px] py-4 text-center">Sin operaciones todavía.</p>
          )}
          {paginatedOps.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center py-2.5 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2">
              <div className="col-span-1">
                {r.kind === "llm" ? (
                  <Zap size={13} className="text-blue-400/70" />
                ) : (
                  <Globe size={13} className="text-amber-400/70" />
                )}
              </div>
              <div className="col-span-2">
                <span className="pill-badge">{getFeatureLabel(r.feature)}</span>
              </div>
              <div className="col-span-3 text-[11px] font-light text-white/50 truncate">{r.label}</div>
              <div className="col-span-2 text-right text-[12px] font-light text-white/40">
                {r.tokens > 0 ? formatNumber(r.tokens) : "—"}
              </div>
              <div className="col-span-2 text-right text-[12px] font-medium text-emerald-400/70">${r.cost.toFixed(4)}</div>
              <div className="col-span-2 text-right text-[11px] text-white/25">
                {new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}{" "}
                {new Date(r.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
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
