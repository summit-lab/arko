"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X, Check, Clock, Calendar } from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { Sale } from "./SaleForm";

interface Installment {
  id: string;
  sale_id: string;
  installment_number: number;
  due_date: string; // YYYY-MM-DD
  amount: number;
  paid_at: string | null;
}

interface InstallmentsModalProps {
  sale: Sale;
  onClose: () => void;
  onSaved: (updated: Sale) => void;
}

function fmtMoney(n: number, locale: string): string {
  const fmtLocale = locale === "en" ? "en-US" : "es-AR";
  return `$${n.toLocaleString(fmtLocale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function isOverdue(dueDate: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dueDate < today;
}

export function InstallmentsModal({ sale, onClose, onSaved }: InstallmentsModalProps) {
  const ct = useChartTheme();
  const t = useTranslations("ventas.installmentsModal");
  const locale = useLocale();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSale, setLocalSale] = useState<Sale>(sale);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}/installments`);
      if (!res.ok) throw new Error(t("errorLoad"));
      const data = await res.json() as Installment[];
      setInstallments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [sale.id, t]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (inst: Installment) => {
    if (togglingId) return;
    setTogglingId(inst.id);
    setError(null);
    const nextPaid = inst.paid_at === null;
    try {
      const res = await fetch(`/api/sales/${sale.id}/installments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_id: inst.id,
          paid: nextPaid,
          // Al marcar manual, usar due_date como paid_at para mantener
          // consistencia con lo que hace el cron (paid_at === due_date).
          paid_at: nextPaid ? `${inst.due_date}T00:00:00Z` : undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? t("errorUpdate"));
      }
      const payload = await res.json() as {
        installment: Installment;
        sale: { id: string; amount_total: number; amount_collected: number; payment_status: string };
      };
      setInstallments(prev => prev.map(x => x.id === inst.id ? payload.installment : x));
      setLocalSale(prev => ({
        ...prev,
        amount_collected: payload.sale.amount_collected,
        payment_status: payload.sale.payment_status,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorUpdate"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleClose = () => {
    // Propagar la venta actualizada al padre para que refresque la tabla.
    onSaved(localSale);
    onClose();
  };

  const paidTotal = installments.filter(i => i.paid_at !== null).reduce((s, i) => s + Number(i.amount), 0);
  const remaining = Math.max(0, sale.amount_total - paidTotal);
  const nextPending = installments.find(i => i.paid_at === null);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: ct.overlayBg, backdropFilter: "blur(14px)" }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl max-h-[90vh] flex flex-col glass-card"
        style={{
          boxShadow: "0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.07] shrink-0">
          <div>
            <h3 className="text-[15px] font-light text-white">{t("title")}</h3>
            <p className="text-[11px] text-white/30 mt-0.5">
              {sale.client_name ?? t("noClient")} — {fmtMoney(sale.amount_total, locale)}
            </p>
          </div>
          <button onClick={handleClose} className="text-white/25 hover:text-white/60 cursor-pointer transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 border-b border-white/[0.06] shrink-0 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em]">{t("summaryCollected")}</p>
            <p className="text-[14px] font-light mt-1" style={{ color: "#4BCEAF" }}>{fmtMoney(paidTotal, locale)}</p>
          </div>
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em]">{t("summaryPending")}</p>
            <p className="text-[14px] font-light mt-1" style={{ color: remaining > 0 ? "#EB6991" : "#4BCEAF" }}>{fmtMoney(remaining, locale)}</p>
          </div>
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em]">{t("summaryNext")}</p>
            <p className="text-[14px] font-light mt-1 text-white/70">
              {nextPending ? fmtDate(nextPending.due_date) : "—"}
            </p>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {loading && <p className="text-[11px] text-white/25 text-center py-6">{t("loading")}</p>}
          {!loading && installments.length === 0 && (
            <p className="text-[11px] text-white/25 text-center py-6">
              {t("empty")}
            </p>
          )}
          {!loading && installments.length > 0 && (
            <div className="space-y-2">
              {installments.map((inst) => {
                const paid = inst.paid_at !== null;
                const overdue = !paid && isOverdue(inst.due_date);
                return (
                  <div
                    key={inst.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-3"
                    style={{
                      background: paid
                        ? "rgba(75,206,175,0.06)"
                        : overdue
                        ? "rgba(235,105,145,0.06)"
                        : "rgba(255,255,255,0.03)",
                      border: paid
                        ? "1px solid rgba(75,206,175,0.18)"
                        : overdue
                        ? "1px solid rgba(235,105,145,0.18)"
                        : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-medium"
                      style={{
                        background: paid ? "rgba(75,206,175,0.15)" : "rgba(255,255,255,0.05)",
                        color: paid ? "#4BCEAF" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {inst.installment_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-white/30 shrink-0" />
                        <span className="text-[12px] text-white/75">{fmtDate(inst.due_date)}</span>
                        {overdue && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(235,105,145,0.12)", color: "#EB6991" }}>
                            {t("overdue")}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-light mt-0.5" style={{ color: paid ? "#4BCEAF" : "rgba(255,255,255,0.7)" }}>
                        {fmtMoney(Number(inst.amount), locale)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggle(inst)}
                      disabled={togglingId === inst.id}
                      className="shrink-0 cursor-pointer transition-all px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-50"
                      style={paid
                        ? { background: "rgba(75,206,175,0.15)", color: "#4BCEAF", border: "1px solid rgba(75,206,175,0.3)" }
                        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                      title={paid ? t("togglePending") : t("togglePaid")}
                    >
                      {togglingId === inst.id
                        ? "…"
                        : paid
                        ? (<span className="flex items-center gap-1.5"><Check className="h-3 w-3" /> {t("paid")}</span>)
                        : (<span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {t("pending")}</span>)
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {error && <p className="text-[11px] text-red-400 mt-3">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.07] shrink-0">
          <p className="text-[10px] text-white/30 leading-relaxed">
            {t("footerNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
