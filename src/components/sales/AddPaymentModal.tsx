"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X, Check } from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { Sale } from "./SaleForm";

interface AddPaymentModalProps {
  sale: Sale;
  onClose: () => void;
  onSaved: (updated: Sale) => void;
}

function fmtMoney(n: number, locale: string): string {
  const fmtLocale = locale === "en" ? "en-US" : "es-AR";
  return `$${n.toLocaleString(fmtLocale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function AddPaymentModal({ sale, onClose, onSaved }: AddPaymentModalProps) {
  const ct = useChartTheme();
  const t = useTranslations("ventas.addPaymentModal");
  const locale = useLocale();
  const remaining = Math.max(0, sale.amount_total - sale.amount_collected);
  const today = new Date().toISOString().split("T")[0];

  const [amount, setAmount] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous re-entry guard — see note in SaleForm.tsx.
  const submittingRef = useRef(false);

  const amountNum = parseFloat(amount) || 0;

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (amountNum <= 0) { setError(t("errorInvalidAmount")); return; }
    if (amountNum > remaining) { setError(t("errorExceedsRemaining", { amount: fmtMoney(remaining, locale) })); return; }

    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/sales/${sale.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, paid_at: paidAt }),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string; message?: string };
        throw new Error(e.message ?? e.error ?? t("errorAddPayment"));
      }
      const updated = await res.json() as Sale | { data: Sale };
      const sale2 = "data" in updated ? updated.data : updated;
      onSaved({ ...sale, ...sale2 });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorAddPayment"));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: ct.overlayBg, backdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl overflow-hidden glass-card"
        style={{
          boxShadow: "0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.07]">
          <div>
            <h3 className="text-[15px] font-light text-white">{t("title")}</h3>
            <p className="text-[11px] text-white/30 mt-0.5">
              {t("remainingHint", { amount: fmtMoney(remaining, locale) })}
            </p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 cursor-pointer transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Monto */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">{t("amountLabel")}</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[13px]">$</span>
              <input
                type="number"
                min="0"
                max={remaining}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-foreground font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">{t("dateLabel")}</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-foreground outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {amountNum > 0 && amountNum <= remaining && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(75,206,175,0.06)", border: "1px solid rgba(75,206,175,0.14)" }}
            >
              <Check className="h-4 w-4 shrink-0" style={{ color: "#4BCEAF" }} />
              <div>
                <p className="text-[11px]" style={{ color: "#4BCEAF" }}>
                  {t("newCollected", { amount: fmtMoney(sale.amount_collected + amountNum, locale) })}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {amountNum >= remaining ? t("willBeFullyPaid") : t("willRemain", { amount: fmtMoney(remaining - amountNum, locale) })}
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-[12px] text-white/40 hover:text-white/60 cursor-pointer transition-colors bg-white/[0.025] border border-white/[0.08]"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || amountNum <= 0 || amountNum > remaining}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white cursor-pointer transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(180deg, rgba(122,134,224,0.22) 0%, rgba(122,134,224,0.12) 100%)",
                border: "1px solid rgba(122,134,224,0.32)",
                borderTop: "1px solid rgba(122,134,224,0.52)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.3)",
              }}
            >
              {loading ? t("saving") : t("submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
