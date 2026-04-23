"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  DollarSign, Plus, TrendingUp, Clock,
  Trash2, Wallet, Pencil,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { DateFilter } from "@/components/ui/DateFilter";
import { resolvePreset } from "@/lib/date-utils";
import type { DateRange as SharedDateRange } from "@/types/date-filter";
import { useChartTheme, type ChartTheme } from "@/hooks/useChartTheme";
import { SaleFormModal } from "@/components/sales/SaleFormModal";
import { AddPaymentModal } from "@/components/sales/AddPaymentModal";
import { InstallmentsModal } from "@/components/sales/InstallmentsModal";
import type { Sale, ReelPicker, StoryPicker } from "@/components/sales/SaleForm";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VentasClientProps {
  initialSales: Sale[];
  reelsForPicker: ReelPicker[];
  storiesForPicker: StoryPicker[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  collected: "Cobrado",
  cancelled: "Cancelado",
  pending: "Pendiente",
};
const STATUS_COLOR: Record<string, string> = {
  collected: "text-teal-300 bg-teal-400/10",
  cancelled: "text-red-400 bg-red-400/10",
  pending: "text-amber-400 bg-amber-400/10",
};
const PAYMENT_LABEL: Record<string, string> = {
  full: "Pago completo",
  cuotas: "Cuotas",
  deposito: "Depósito/Seña",
};
const SOURCE_LABEL: Record<string, string> = {
  reel: "Reel",
  historia: "Historia",
  post: "Post",
  link_bio: "Link en Bio",
  cta_bio: "CTA Bio",
  otro: "Otro",
};
const SOURCE_HEX: Record<string, string> = {
  reel: "#7A86E0",
  historia: "#AF6EC7",
  post: "#4BCEAF",
  link_bio: "#EB6991",
  cta_bio: "#F59E0B",
  otro: "#9B9BA8",
};
const SOURCE_BG: Record<string, string> = {
  reel: "rgba(122,134,224,0.12)",
  historia: "rgba(175,110,199,0.12)",
  post: "rgba(75,206,175,0.12)",
  link_bio: "rgba(235,105,145,0.12)",
  cta_bio: "rgba(245,158,11,0.12)",
  otro: "rgba(155,155,168,0.12)",
};

const PALETTE = ["#7A86E0", "#AF6EC7", "#4BCEAF", "#EB6991", "#A5ADEE"];

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function SalesTooltip({ active, payload, label, ct }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey?: string; name?: string; color?: string }>;
  label?: string;
  ct: ChartTheme;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[11px] space-y-1"
      style={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, backdropFilter: "blur(20px)", boxShadow: ct.tooltipShadow }}
    >
      <p className="mb-1" style={{ color: ct.tooltipMuted }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: ct.tooltipMuted }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.name ?? p.dataKey}
          </span>
          <span className="font-medium" style={{ color: p.color }}>{fmtMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VentasClient({ initialSales, reelsForPicker, storiesForPicker }: VentasClientProps) {
  const ct = useChartTheme();
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [showModal, setShowModal] = useState(false);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [activeRange, setActiveRange] = useState<SharedDateRange>(() => resolvePreset("este_mes"));

  // Date filtering
  const filteredSales = useMemo(() => {
    if (!activeRange.from && !activeRange.to) return sales;
    return sales.filter(s => {
      if (activeRange.from && s.sale_date < activeRange.from) return false;
      if (activeRange.to && s.sale_date > activeRange.to) return false;
      return true;
    });
  }, [sales, activeRange]);

  // KPIs (use filtered sales)
  const activeSales    = filteredSales.filter(s => s.payment_status !== "cancelled");
  const totalRevenue   = activeSales.reduce((s, v) => s + v.amount_total, 0);
  const totalCollected = activeSales.reduce((s, v) => s + v.amount_collected, 0);
  const totalPending   = totalRevenue - totalCollected;

  // Monthly chart (last 6 months) — 2 series por mes:
  //   facturado   = SUM(amount_total) por mes de sale_date (todo el deal
  //                 se factura el día que se vende, independiente de cómo
  //                 se cobre después).
  //   recolectado = SUM por mes de paid_at de cada cuota (cashflow real).
  //                 Para full/deposito sin cuotas, va todo al mes de
  //                 sale_date (el cobro se asumió al momento de la venta).
  //
  // Esto refleja el patrón contable estándar: revenue recognition al
  // momento de la venta, cashflow en el momento del cobro.
  const monthlyMap = new Map<string, { facturado: number; recolectado: number }>();
  const addTo = (key: string, bucket: "facturado" | "recolectado", amount: number) => {
    if (!amount) return;
    const entry = monthlyMap.get(key) ?? { facturado: 0, recolectado: 0 };
    entry[bucket] += amount;
    monthlyMap.set(key, entry);
  };
  activeSales.forEach(s => {
    const saleKey = s.sale_date.slice(0, 7);
    const installments = s.installments ?? [];

    // Facturación siempre al mes del sale_date.
    addTo(saleKey, "facturado", s.amount_total);

    if (s.payment_type === "cuotas" && installments.length > 0) {
      // Recolectado: cada cuota paid se suma al mes de su paid_at.
      installments.forEach(i => {
        if (i.paid_at) {
          addTo(i.paid_at.slice(0, 7), "recolectado", Number(i.amount));
        }
      });
    } else {
      // Full o depósito: todo el cobrado va al mes de sale_date.
      addTo(saleKey, "recolectado", s.amount_collected);
    }
  });
  const chartData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, v]) => {
      const [y, m] = month.split("-");
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return {
        label: d.toLocaleString("es", { month: "short" }).replace(".", ""),
        facturado: v.facturado,
        recolectado: v.recolectado,
      };
    });

  // Attribution by source_type
  const sourceMap = new Map<string, number>();
  activeSales.forEach(s => {
    sourceMap.set(s.source_type, (sourceMap.get(s.source_type) ?? 0) + s.amount_total);
  });
  const sourceData = Array.from(sourceMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([key, amount]) => ({
      key,
      label: SOURCE_LABEL[key] ?? key,
      amount,
      pct: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
    }));

  const handleSaved = (s: Sale) => {
    setSales(prev => [s, ...prev]);
    setShowModal(false);
  };

  const handlePaymentSaved = (updated: Sale) => {
    setSales(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated, reels: s.reels } : s)));
    setPaymentSale(null);
  };

  const handleEditSaved = (updated: Sale) => {
    setSales(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated, reels: s.reels } : s)));
    setEditingSale(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta venta?")) return;
    await fetch(`/api/sales/${id}`, { method: "DELETE" });
    setSales(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="px-8 py-10">
      {/* ── Header ── */}
      <div className="animate-slide-up mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">Ventas</h1>
          <p className="text-white/35 mt-3 text-[15px] font-light">Facturación generada desde tu contenido.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium text-white cursor-pointer transition-all hover:brightness-110"
          style={{ background: "rgba(122,134,224,0.1)", border: "1px solid rgba(122,134,224,0.22)" }}
        >
          <Plus className="h-4 w-4" style={{ color: "#7A86E0" }} />
          Nueva venta
        </button>
      </div>

      {/* ── Date filter ── */}
      {/* relative + z-20: el dropdown del DateFilter tiene que quedar por
          encima de los KPI cards hermanos. animate-slide-up crea un stacking
          context nuevo, y el orden DOM hace que el grid tape al dropdown si
          no forzamos. Mismo patrón que el header del dashboard principal.
          Menor que el topbar global (z-50) para no taparlo al hacer scroll. */}
      <div className="mb-8 animate-slide-up stagger-1 relative z-20">
        <DateFilter
          mode="state"
          defaultPreset="este_mes"
          onChange={setActiveRange}
        />
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-5 mb-8 animate-slide-up stagger-1">
        {([
          {
            label: "Facturación",
            value: fmtMoney(totalRevenue),
            sub: `${activeSales.length} venta${activeSales.length !== 1 ? "s" : ""}`,
            icon: DollarSign,
            hex: "#7A86E0",
            bg: "rgba(122,134,224,0.08)",
          },
          {
            label: "Efectivo Recolectado",
            value: fmtMoney(totalCollected),
            sub: totalRevenue > 0 ? `${Math.round((totalCollected / totalRevenue) * 100)}% del total` : "—",
            icon: TrendingUp,
            hex: "#4BCEAF",
            bg: "rgba(75,206,175,0.08)",
          },
          {
            label: "Por Cobrar",
            value: fmtMoney(totalPending),
            sub: "pendiente de cobro",
            icon: Clock,
            hex: "#EB6991",
            bg: "rgba(235,105,145,0.08)",
          },
        ] as const).map((k) => (
          <div key={k.label} className="glass-card px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] font-medium text-white/40 uppercase tracking-[0.08em]">{k.label}</p>
              <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon className="h-[17px] w-[17px]" style={{ color: k.hex }} />
              </div>
            </div>
            <p className="text-[28px] font-light text-white tracking-[-0.02em]">{k.value}</p>
            <p className="text-[11px] text-white/25 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* ── Left: chart + table ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Monthly chart — 2 barras por mes: Facturación (azul) y Efectivo
              recolectado (verde). */}
          {chartData.length > 0 && (
            <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[13px] font-light text-white/80">Facturación mensual</h3>
                <div className="flex items-center gap-4 text-[10px] text-white/40">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: "#7A86E0" }} />
                    Facturación
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: "#34d399" }} />
                    Efectivo recolectado
                  </span>
                </div>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: ct.axisTick }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: ct.axisTick }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}K` : v}`}
                    />
                    <Tooltip content={<SalesTooltip ct={ct} />} cursor={{ fill: ct.cursor }} />
                    <Bar dataKey="facturado" name="Facturación" fill="#7A86E0" radius={[4, 4, 0, 0]} barSize={56} />
                    <Bar dataKey="recolectado" name="Efectivo recolectado" fill="#34d399" radius={[4, 4, 0, 0]} barSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sales table */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-3">
            <h3 className="text-[13px] font-light text-white/80 mb-5">Historial de ventas</h3>
            {filteredSales.length === 0 ? (
              <div className="py-14 text-center">
                <DollarSign className="h-10 w-10 text-white/[0.07] mx-auto mb-3" />
                <p className="text-[13px] text-white/25 font-light">No hay ventas registradas aún</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 text-[12px] cursor-pointer transition-opacity hover:opacity-80"
                  style={{ color: "rgba(122,134,224,0.7)" }}
                >
                  + Nueva venta
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {/* Header row */}
                <div
                  className="grid grid-cols-12 gap-2 text-[10px] text-white/25 uppercase tracking-[0.1em] pb-2.5 px-2 border-b border-white/[0.05]"
                >
                  <div className="col-span-4">Fuente / Cliente</div>
                  <div className="col-span-2 text-right">Facturación</div>
                  <div className="col-span-2 text-right">Recolectado</div>
                  <div className="col-span-2 text-center">Tipo</div>
                  <div className="col-span-2 text-center">Estado</div>
                </div>

                {filteredSales.map((s) => {
                  const hasPending =
                    s.payment_type === "cuotas" &&
                    s.payment_status !== "cancelled" &&
                    s.amount_collected < s.amount_total;
                  const progressPct = s.amount_total > 0
                    ? Math.min(100, Math.round((s.amount_collected / s.amount_total) * 100))
                    : 0;
                  const remaining = Math.max(0, s.amount_total - s.amount_collected);

                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-12 gap-2 items-center py-3 px-2 rounded-xl hover:bg-white/[0.025] transition-all group"
                    >
                      {/* Source / Content */}
                      <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                        {s.reels?.thumbnail_url ? (
                          <div className="relative h-9 w-6 rounded overflow-hidden shrink-0">
                            <Image src={s.reels.thumbnail_url} alt="" fill className="object-cover" sizes="24px" />
                          </div>
                        ) : (
                          <div
                            className="h-9 w-6 rounded shrink-0 flex items-center justify-center text-[9px] font-bold"
                            style={{
                              background: SOURCE_BG[s.source_type] ?? "var(--muted)",
                              color: SOURCE_HEX[s.source_type] ?? "var(--muted-foreground)",
                            }}
                          >
                            {SOURCE_LABEL[s.source_type]?.[0] ?? "?"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-light text-foreground/70 truncate leading-snug">
                            {s.reels?.caption?.slice(0, 40) ||
                              s.source_label?.slice(0, 40) ||
                              SOURCE_LABEL[s.source_type] ||
                              "Venta"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[9px] px-1.5 py-[2px] rounded-full font-medium"
                              style={{
                                color: SOURCE_HEX[s.source_type] ?? "var(--muted-foreground)",
                                background: SOURCE_BG[s.source_type] ?? "var(--muted)",
                              }}
                            >
                              {SOURCE_LABEL[s.source_type] ?? s.source_type}
                            </span>
                            {s.client_name && (
                              <span className="text-[9px] text-white/25 truncate">{s.client_name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Revenue */}
                      <div className="col-span-2 text-right text-[13px] font-light text-white">
                        {fmtMoney(s.amount_total)}
                      </div>

                      {/* Collected + progress bar for cuotas */}
                      <div className="col-span-2 text-right">
                        <div className="text-[12px] font-light" style={{ color: "#4BCEAF" }}>
                          {fmtMoney(s.amount_collected)}
                        </div>
                        {hasPending && (
                          <>
                            <div className="h-[3px] w-full rounded-full overflow-hidden mt-1 bg-white/[0.05]">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${progressPct}%`, background: "rgba(75,206,175,0.55)" }}
                              />
                            </div>
                            <p className="text-[9px] text-white/30 mt-0.5">
                              falta {fmtMoney(remaining)}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Payment type */}
                      <div className="col-span-2 text-center">
                        <span className="text-[9px] text-white/30">
                          {PAYMENT_LABEL[s.payment_type] ?? s.payment_type}
                        </span>
                      </div>

                      {/* Status + actions */}
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        <span className={`text-[9px] font-medium px-2 py-1 rounded-full ${STATUS_COLOR[s.payment_status] ?? "text-white/40 bg-white/[0.05]"}`}>
                          {STATUS_LABEL[s.payment_status] ?? s.payment_status}
                        </span>
                        {hasPending && (
                          <button
                            onClick={() => setPaymentSale(s)}
                            title="Agregar pago"
                            className="cursor-pointer transition-colors shrink-0"
                            style={{ color: "rgba(75,206,175,0.75)" }}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingSale(s)}
                          title="Editar venta"
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white/25 hover:text-white/70 shrink-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          title="Eliminar venta"
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white/20 hover:text-red-400 shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        {activeSales.length > 0 && (
          <div className="w-[280px] shrink-0 space-y-4 animate-slide-up stagger-2">

            {/* Attribution: Fuentes de revenue */}
            {sourceData.length > 0 && (
              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-[11px] font-medium text-white/35 uppercase tracking-[0.1em] mb-5">Fuentes de facturación</h3>
                <div className="space-y-4">
                  {sourceData.map((s, i) => (
                    <div key={s.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: PALETTE[i % PALETTE.length] }}
                          />
                          <span className="text-[11px] text-white/60">{s.label}</span>
                        </div>
                        <span className="text-[11px] font-light text-white">{fmtMoney(s.amount)}</span>
                      </div>
                      <div className="h-[3px] rounded-full overflow-hidden bg-white/[0.05]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${s.pct}%`, background: PALETTE[i % PALETTE.length] }}
                        />
                      </div>
                      <p className="text-[9px] text-white/25 mt-0.5 text-right">{s.pct}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top contenido */}
            {activeSales.filter(s => s.reels).length > 0 && (
              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-[11px] font-medium text-white/35 uppercase tracking-[0.1em] mb-4">Top contenido</h3>
                <div className="space-y-3">
                  {activeSales
                    .filter(s => s.reels)
                    .sort((a, b) => b.amount_total - a.amount_total)
                    .slice(0, 6)
                    .map((s, i) => (
                      <div key={s.id} className="flex items-start gap-2.5">
                        <span className="text-[10px] text-white/20 w-4 shrink-0 mt-0.5">{i + 1}</span>
                        {s.reels?.thumbnail_url && (
                          <div className="relative h-10 w-7 rounded overflow-hidden shrink-0">
                            <Image src={s.reels.thumbnail_url} alt="" fill className="object-cover" sizes="28px" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-light text-white/55 truncate leading-snug">
                            {s.reels?.caption?.slice(0, 40) || "Sin título"}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[11px] font-light" style={{ color: "#4BCEAF" }}>
                              {fmtMoney(s.amount_total)}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_COLOR[s.payment_status] ?? ""}`}>
                              {STATUS_LABEL[s.payment_status]}
                            </span>
                          </div>
                          <div className="h-[2px] mt-1.5 rounded-full overflow-hidden bg-white/[0.05]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((s.amount_total / (activeSales.filter(x => x.reels)[0]?.amount_total || 1)) * 100)}%`,
                                background: "rgba(75,206,175,0.45)",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <SaleFormModal
          reels={reelsForPicker}
          stories={storiesForPicker}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editingSale && (
        <SaleFormModal
          reels={reelsForPicker}
          stories={storiesForPicker}
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={handleEditSaved}
        />
      )}

      {paymentSale && paymentSale.payment_type === "cuotas" && (
        <InstallmentsModal
          sale={paymentSale}
          onClose={() => setPaymentSale(null)}
          onSaved={handlePaymentSaved}
        />
      )}

      {paymentSale && paymentSale.payment_type !== "cuotas" && (
        <AddPaymentModal
          sale={paymentSale}
          onClose={() => setPaymentSale(null)}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  );
}
