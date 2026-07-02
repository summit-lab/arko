import { createClient } from "@/lib/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowDownWideNarrow, Infinity as InfinityIcon } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTier, TIER_LABEL, type Tier } from "@/lib/tier/config";
import { creditView, type CreditBalanceRow } from "@/lib/credits";

interface UsageRow {
  workspace_id: string;
  cost_usd: number;
}

const MS_PER_DAY = 86_400_000;

// Conteo regresivo del trial. Devuelve null si el workspace no tiene trial
// (ej. cuentas admin). `remaining` puede ser negativo si ya venció.
function computeTrial(trialDays: number | null, trialEndsAt: string | null) {
  if (!trialDays || !trialEndsAt) return null;
  const remaining = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / MS_PER_DAY);
  const elapsed = Math.min(trialDays, Math.max(0, trialDays - remaining));
  return { total: trialDays, remaining, elapsed };
}

/** Suma cost_usd por workspace paginando (PostgREST capea a ~1000 filas/request). */
async function sumUsageByWorkspace(
  supabase: SupabaseClient,
  table: string,
  sinceIso: string,
  successOnly: boolean,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const PAGE = 1000;
  for (let i = 0; i < 25; i++) {
    let q = supabase
      .from(table)
      .select("workspace_id, cost_usd")
      .gte("created_at", sinceIso)
      .range(i * PAGE, i * PAGE + PAGE - 1);
    if (successOnly) q = q.eq("status", "success");
    const { data, error } = await q;
    if (error) { console.error(`[admin/clients] ${table} usage error:`, error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data as UsageRow[]) {
      map.set(row.workspace_id, (map.get(row.workspace_id) ?? 0) + Number(row.cost_usd));
    }
    if (data.length < PAGE) break;
  }
  return map;
}

type SortKey = "created" | "usage" | "coins" | "plan";
const TIER_RANK: Record<Tier, number> = { pro: 0, standard: 1, demo: 2 };
const TIER_BADGE: Record<Tier, string> = {
  demo: "bg-white/[0.08] text-white/50",
  standard: "bg-amber-500/15 text-amber-400",
  pro: "bg-violet-500/15 text-violet-300",
};

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortParam } = await searchParams;
  const sort: SortKey = (["created", "usage", "coins", "plan"] as const).includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "created";

  const supabase = await createClient();
  const t = await getTranslations("admin.clients");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";

  const since30d = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();

  // Workspaces (con plan) + balances de coins + usage 30d de AMBAS tablas
  // (antes: solo llm_usage all-time capado a 1000 filas — el número mentía).
  const [{ data: workspaces, error: wsError }, { data: balances }, llmUsage, intUsage] = await Promise.all([
    supabase
      .from("workspaces")
      .select(`
        id, name, slug, is_active, created_at, owner_id, onboarding_completed,
        plan, trial_days, trial_ends_at,
        meta_connections (status, ig_username)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("workspace_credit_balances")
      .select("workspace_id, period_date, spent_today_coins, unlimited, bonus_daily_coins"),
    sumUsageByWorkspace(supabase, "llm_usage", since30d, false),
    sumUsageByWorkspace(supabase, "integration_usage", since30d, true),
  ]);
  if (wsError) console.error('[admin/clients] workspaces error:', wsError);

  const balanceMap = new Map(
    ((balances ?? []) as (CreditBalanceRow & { workspace_id: string })[]).map((b) => [b.workspace_id, b]),
  );

  // Fetch all profiles separately (no FK between workspaces and profiles)
  const ownerIds = (workspaces ?? []).map((w) => w.owner_id).filter(Boolean);
  const { data: profiles, error: profilesError } = ownerIds.length > 0
    ? await supabase.from("profiles").select("id, email, full_name, role").in("id", ownerIds)
    : { data: [] as { id: string; email: string; full_name: string | null; role: string }[], error: null };
  if (profilesError) console.error('[admin/clients] profiles error:', profilesError);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const clients = (workspaces ?? []).map((w) => {
    const profile = profileMap.get(w.owner_id);
    const connection = Array.isArray(w.meta_connections) ? w.meta_connections[0] : w.meta_connections;
    const tier = resolveTier((w.plan as string | null) ?? null, (w.trial_ends_at as string | null) ?? null);
    const balance = balanceMap.get(w.id) ?? null;
    const coins = creditView(tier, balance);
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      is_active: w.is_active,
      onboarding_completed: w.onboarding_completed,
      created_at: w.created_at,
      owner_email: profile?.email ?? "—",
      owner_name: profile?.full_name ?? "—",
      owner_role: profile?.role ?? "user",
      connection_status: connection?.status ?? null,
      ig_username: connection?.ig_username ?? null,
      tier,
      coins,
      total_cost: (llmUsage.get(w.id) ?? 0) + (intUsage.get(w.id) ?? 0),
      trial: computeTrial(w.trial_days, w.trial_ends_at),
    };
  });

  // Ordenamiento (header clickeable → ?sort=)
  const sorted = [...clients].sort((a, b) => {
    switch (sort) {
      case "usage": return b.total_cost - a.total_cost;
      case "coins": {
        // Más gastado (en % del cupo) primero; unlimited al final.
        const pa = a.coins.unlimited ? -1 : a.coins.allotment > 0 ? a.coins.spent / a.coins.allotment : 0;
        const pb = b.coins.unlimited ? -1 : b.coins.allotment > 0 ? b.coins.spent / b.coins.allotment : 0;
        return pb - pa;
      }
      case "plan": return TIER_RANK[a.tier] - TIER_RANK[b.tier];
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const SortHeader = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <Link
      href={k === "created" ? "/admin/clients" : `/admin/clients?sort=${k}`}
      className={`inline-flex items-center gap-1 hover:text-white/60 transition-colors ${sort === k ? "text-white/70" : ""} ${className ?? ""}`}
    >
      {children}
      {sort === k && <ArrowDownWideNarrow size={10} />}
    </Link>
  );

  return (
    <div className="px-8 py-10 space-y-8">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">
          {t("subtitle")}
        </p>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <div className="space-y-1">
          {/* Header — Plan / Coins / Uso / Creada son ordenables */}
          <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium pb-3 border-b border-white/[0.06] px-2">
            <div className="col-span-3">{t("headerWorkspace")}</div>
            <div className="col-span-2">{t("headerOwner")}</div>
            <div className="col-span-1 text-center"><SortHeader k="plan">Plan</SortHeader></div>
            <div className="col-span-1 text-center">{t("headerConnection")}</div>
            <div className="col-span-2 text-center">{t("headerTrial")}</div>
            <div className="col-span-1 text-center">{t("headerAdn")}</div>
            <div className="col-span-2 text-center"><SortHeader k="coins">Coins hoy</SortHeader></div>
            <div className="col-span-1 text-right"><SortHeader k="usage">Uso 30d</SortHeader></div>
            <div className="col-span-1 text-right"><SortHeader k="created">{t("headerCreated")}</SortHeader></div>
          </div>

          {sorted.length === 0 && (
            <p className="text-white/25 text-[13px] py-4 text-center">{t("empty")}</p>
          )}

          {sorted.map((c) => {
            const coinsPct = c.coins.unlimited || c.coins.allotment <= 0
              ? 0
              : Math.min(100, Math.round((c.coins.spent / c.coins.allotment) * 100));
            return (
              <Link
                key={c.id}
                href={`/admin/clients/${c.id}`}
                className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-2 items-center py-3.5 rounded-lg hover:bg-white/[0.03] transition-all duration-200 px-2 cursor-pointer"
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`shrink-0 inline-block h-1.5 w-1.5 rounded-full ${c.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
                    <p className="text-[13px] font-light text-white/70 truncate">{c.name}</p>
                  </div>
                  <p className="text-[11px] text-white/25 mt-0.5 truncate">{c.slug}</p>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-light text-white/60 truncate">{c.owner_name}</p>
                    {c.owner_role === "admin" && (
                      <span className="text-[9px] font-medium text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">admin</span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/25 mt-0.5 truncate">{c.owner_email}</p>
                </div>
                <div className="col-span-1 text-center">
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${TIER_BADGE[c.tier]}`}>
                    {TIER_LABEL[c.tier]}
                  </span>
                </div>
                <div className="col-span-1 text-center">
                  {c.connection_status === "active" ? (
                    <span className="text-[11px] text-emerald-400 truncate block">@{c.ig_username}</span>
                  ) : (
                    <span className="text-[11px] text-white/25">—</span>
                  )}
                </div>
                <div className="col-span-2 px-2">
                  {c.trial ? (
                    c.trial.remaining > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`text-[12px] font-medium ${
                            c.trial.remaining > 7 ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {c.trial.remaining} {t("trialDays")}
                          <span className="text-white/25"> / {c.trial.total}</span>
                        </span>
                        <span className="h-1 w-full max-w-[90px] rounded-full bg-white/[0.08] overflow-hidden">
                          <span
                            className={`block h-full rounded-full ${
                              c.trial.remaining > 7 ? "bg-emerald-400/70" : "bg-amber-400/70"
                            }`}
                            style={{ width: `${Math.round((c.trial.elapsed / c.trial.total) * 100)}%` }}
                          />
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                        {t("trialExpired")}
                      </span>
                    )
                  ) : (
                    <span className="text-[12px] text-white/20 block text-center">—</span>
                  )}
                </div>
                <div className="col-span-1 text-center">
                  {c.onboarding_completed ? (
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="text-[10px] text-amber-400/60">{t("pending")}</span>
                  )}
                </div>
                <div className="col-span-2 px-2">
                  {c.coins.unlimited ? (
                    <span className="flex items-center justify-center gap-1 text-[12px] text-yellow-400/90">
                      <InfinityIcon size={13} /> ilimitadas
                    </span>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[11px] font-medium tabular-nums ${coinsPct >= 80 ? "text-rose-400" : coinsPct >= 50 ? "text-amber-400" : "text-white/50"}`}>
                        {c.coins.remaining}
                        <span className="text-white/25"> / {c.coins.allotment}</span>
                      </span>
                      <span className="h-1 w-full max-w-[80px] rounded-full bg-white/[0.08] overflow-hidden">
                        <span
                          className={`block h-full rounded-full ${coinsPct >= 80 ? "bg-rose-400/70" : coinsPct >= 50 ? "bg-amber-400/70" : "bg-emerald-400/60"}`}
                          style={{ width: `${coinsPct}%` }}
                        />
                      </span>
                    </div>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  <span className={`text-[12px] font-medium ${c.total_cost > 0.005 ? "text-emerald-400/80" : "text-white/20"}`}>
                    ${c.total_cost.toFixed(2)}
                  </span>
                </div>
                <div className="col-span-1 text-right text-[11px] text-white/30">
                  {new Date(c.created_at).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
