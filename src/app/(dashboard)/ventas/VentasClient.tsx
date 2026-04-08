"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  DollarSign, Plus, TrendingUp, Clock, X, Check,
  Search, Trash2, Play, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sale {
  id: string;
  source_type: string;
  source_label: string | null;
  amount_total: number;
  amount_collected: number;
  payment_type: string;
  payment_status: string;
  sale_date: string;
  payment_method: string | null;
  notes: string | null;
  client_name: string | null;
  reel_id: string | null;
  reels: { id: string; caption: string | null; thumbnail_url: string | null; permalink: string | null } | null;
}

interface ReelPicker {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
}

interface StoryPicker {
  id: string;
  published_at: string;
  total_impressions: number;
  total_reach: number;
  slide_count: number;
  first_thumbnail: string | null;
}

interface VentasClientProps {
  initialSales: Sale[];
  reelsForPicker: ReelPicker[];
  storiesForPicker: StoryPicker[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
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
  otro: "Otro",
};
const SOURCE_HEX: Record<string, string> = {
  reel: "#7A86E0",
  historia: "#AF6EC7",
  post: "#4BCEAF",
  link_bio: "#EB6991",
  otro: "rgba(255,255,255,0.3)",
};
const SOURCE_BG: Record<string, string> = {
  reel: "rgba(122,134,224,0.12)",
  historia: "rgba(175,110,199,0.12)",
  post: "rgba(75,206,175,0.12)",
  link_bio: "rgba(235,105,145,0.12)",
  otro: "rgba(255,255,255,0.05)",
};
// ─── Date range presets ─────────────────────────────────────────────────────

type DatePreset = "hoy" | "ayer" | "7d" | "mes" | "custom";

interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function getPresetRange(preset: DatePreset): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toISO = (d: Date) => d.toISOString().split("T")[0];
  const todayStr = toISO(today);

  switch (preset) {
    case "hoy":
      return { from: todayStr, to: todayStr };
    case "ayer": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: toISO(y), to: toISO(y) };
    }
    case "7d": {
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      return { from: toISO(d7), to: todayStr };
    }
    case "mes": {
      const m1 = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toISO(m1), to: todayStr };
    }
    case "custom":
      return { from: "", to: "" };
  }
}

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "Última semana" },
  { key: "mes", label: "Este mes" },
  { key: "custom", label: "Personalizado" },
];

// ─── Date Range Picker ───────────────────────────────────────────────────────

function DateRangeFilter({ preset, range, onPreset, onRange }: {
  preset: DatePreset;
  range: DateRange;
  onPreset: (p: DatePreset) => void;
  onRange: (r: DateRange) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className="inline-flex items-center gap-0.5 p-0.5 rounded-full"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {DATE_PRESETS.map(p => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onPreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                active ? "text-white" : "text-white/35 hover:text-white/55"
              }`}
              style={active ? {
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 1px 8px rgba(255,255,255,0.04)",
              } : undefined}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={range.from}
            onChange={e => onRange({ ...range, from: e.target.value })}
            className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-white/20 transition-colors"
            style={{ colorScheme: "dark" }}
          />
          <span className="text-[10px] text-white/25">—</span>
          <input
            type="date"
            value={range.to}
            onChange={e => onRange({ ...range, to: e.target.value })}
            className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-white/20 transition-colors"
            style={{ colorScheme: "dark" }}
          />
        </div>
      )}
    </div>
  );
}
const PALETTE = ["#7A86E0", "#AF6EC7", "#4BCEAF", "#EB6991", "#A5ADEE"];

// ─── Modal ────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  reel_id: "",
  story_sequence_id: "",
  source_type: "reel",
  source_label: "",
  amount_total: "",
  n_cuotas: "3",
  amount_collected: "",
  expected_date: "",
  payment_type: "full",
  sale_date: new Date().toISOString().split("T")[0],
  notes: "",
  client_name: "",
};

function NewSaleModal({ reels, stories, onClose, onSaved }: {
  reels: ReelPicker[];
  stories: StoryPicker[];
  onClose: () => void;
  onSaved: (s: Sale) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const filtered = useMemo(() =>
    reels.filter(r => (r.caption ?? "").toLowerCase().includes(search.toLowerCase())).slice(0, 20)
  , [reels, search]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const amountTotal    = parseFloat(form.amount_total) || 0;
  const nCuotas        = Math.max(1, parseInt(form.n_cuotas) || 1);
  const perCuota       = amountTotal > 0 ? Math.round(amountTotal / nCuotas) : 0;
  const amountCollected =
    form.payment_type === "full" ? amountTotal : (parseFloat(form.amount_collected) || 0);
  const amountPending  = Math.max(0, amountTotal - amountCollected);

  const derivedStatus = (): string => {
    if (form.payment_type === "full") return "collected";
    if (amountTotal > 0 && amountCollected >= amountTotal) return "collected";
    return "pending";
  };

  const buildNotes = (): string | null => {
    let base = form.notes.trim();
    if (form.payment_type === "cuotas" && amountTotal > 0) {
      const info = `${nCuotas} cuota${nCuotas !== 1 ? "s" : ""} de ${fmtMoney(perCuota)}`;
      base = base ? `${info} | ${base}` : info;
    }
    if (form.payment_type === "deposito" && form.expected_date) {
      const info = `Cobro restante estimado: ${fmtDate(form.expected_date)}`;
      base = base ? `${info} | ${base}` : info;
    }
    return base || null;
  };

  const handleSave = async () => {
    if (!amountTotal || amountTotal <= 0) { setError("Ingresá un monto válido"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reel_id:          form.reel_id || null,
          story_sequence_id: form.story_sequence_id || null,
          source_type:      form.source_type,
          source_label:     form.source_label || null,
          amount_total:     amountTotal,
          amount_collected: amountCollected,
          payment_type:     form.payment_type,
          payment_status:   derivedStatus(),
          sale_date:        form.sale_date,
          payment_method:   null,
          notes:            buildNotes(),
          client_name:      form.client_name || null,
          client_contact:   null,
        }),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const saved = await res.json() as Sale;
      const reel  = reels.find(r => r.id === form.reel_id);
      onSaved({
        ...saved,
        reels: reel
          ? { id: reel.id, caption: reel.caption, thumbnail_url: reel.thumbnail_url, permalink: null }
          : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(14px)" }}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 40%, rgba(14,14,26,0.97) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderTop: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <h3 className="text-[15px] font-light text-white">Nueva Venta</h3>
            <p className="text-[11px] text-white/30 mt-0.5">
              Paso {step} de 2 — {step === 1 ? "Información de la venta" : "Fuente & Cliente"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 cursor-pointer transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex px-6 pt-4 gap-1.5">
          {[1, 2].map(n => (
            <div
              key={n}
              className="flex-1 h-[2px] rounded-full transition-all duration-300"
              style={{ background: step >= n ? "#7A86E0" : "rgba(255,255,255,0.07)" }}
            />
          ))}
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Step 1: Información de la venta ── */}
          {step === 1 && (
            <>
              {/* Payment type tabs */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Tipo de pago</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.entries(PAYMENT_LABEL).map(([k, label]) => {
                    const active = form.payment_type === k;
                    return (
                      <button
                        key={k}
                        onClick={() => { set("payment_type", k); set("amount_collected", ""); }}
                        className={`py-2.5 rounded-xl text-[11px] font-medium cursor-pointer transition-all ${active ? "text-white" : "text-white/30 hover:text-white/55"}`}
                        style={active
                          ? {
                              background: "linear-gradient(180deg, rgba(122,134,224,0.2) 0%, rgba(122,134,224,0.1) 100%)",
                              border: "1px solid rgba(122,134,224,0.35)",
                              borderTop: "1px solid rgba(122,134,224,0.55)",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.25)",
                            }
                          : { border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Full payment ── */}
              {form.payment_type === "full" && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Monto cobrado</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[13px]">$</span>
                      <input
                        type="number"
                        value={form.amount_total}
                        onChange={e => set("amount_total", e.target.value)}
                        placeholder="0"
                        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-white font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                  </div>
                  {amountTotal > 0 && (
                    <div
                      className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={{ background: "rgba(75,206,175,0.06)", border: "1px solid rgba(75,206,175,0.14)" }}
                    >
                      <Check className="h-4 w-4 shrink-0" style={{ color: "#4BCEAF" }} />
                      <div>
                        <p className="text-[11px]" style={{ color: "#4BCEAF" }}>
                          Pago completo — {fmtMoney(amountTotal)}
                        </p>
                        <p className="text-[10px] text-white/30 mt-0.5">Facturación y efectivo recolectado coinciden</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Cuotas ── */}
              {form.payment_type === "cuotas" && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Valor total del deal</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[13px]">$</span>
                      <input
                        type="number"
                        value={form.amount_total}
                        onChange={e => set("amount_total", e.target.value)}
                        placeholder="0"
                        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-white font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">N° de cuotas</label>
                      <input
                        type="number"
                        min="2"
                        max="36"
                        value={form.n_cuotas}
                        onChange={e => set("n_cuotas", e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-3 text-[15px] text-white font-light outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Valor por cuota</label>
                      <div
                        className="rounded-xl px-3 py-3 text-[15px] text-white/35 font-light"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        {perCuota > 0 ? fmtMoney(perCuota) : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Cobrado hasta hoy</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[13px]">$</span>
                      <input
                        type="number"
                        value={form.amount_collected}
                        onChange={e => set("amount_collected", e.target.value)}
                        placeholder="0"
                        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-white font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                  </div>
                  {amountTotal > 0 && (
                    <div
                      className="rounded-xl px-4 py-3 space-y-2"
                      style={{ background: "rgba(122,134,224,0.05)", border: "1px solid rgba(122,134,224,0.14)" }}
                    >
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Facturación</span>
                        <span className="text-white">{fmtMoney(amountTotal)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Efectivo recolectado</span>
                        <span style={{ color: "#4BCEAF" }}>{fmtMoney(amountCollected)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-white/40">Por cobrar</span>
                        <span style={{ color: "#EB6991" }}>{fmtMoney(amountPending)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Depósito/Seña ── */}
              {form.payment_type === "deposito" && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Valor total del deal</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[13px]">$</span>
                      <input
                        type="number"
                        value={form.amount_total}
                        onChange={e => set("amount_total", e.target.value)}
                        placeholder="0"
                        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-white font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Seña / depósito</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-[13px]">$</span>
                        <input
                          type="number"
                          value={form.amount_collected}
                          onChange={e => set("amount_collected", e.target.value)}
                          placeholder="0"
                          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-white font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Cobro restante estimado</label>
                      <input
                        type="date"
                        value={form.expected_date}
                        onChange={e => set("expected_date", e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-3 text-[12px] text-white outline-none focus:border-white/20 transition-colors"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  </div>
                  {amountTotal > 0 && (
                    <div
                      className="rounded-xl px-4 py-3 space-y-2"
                      style={{ background: "rgba(175,110,199,0.05)", border: "1px solid rgba(175,110,199,0.14)" }}
                    >
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Facturación</span>
                        <span className="text-white">{fmtMoney(amountTotal)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Seña cobrada</span>
                        <span style={{ color: "#4BCEAF" }}>{fmtMoney(amountCollected)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-white/40">Por cobrar</span>
                        <span style={{ color: "#EB6991" }}>{fmtMoney(amountPending)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Date + notes */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Fecha de venta</label>
                <input
                  type="date"
                  value={form.sale_date}
                  onChange={e => set("sale_date", e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-white outline-none focus:border-white/20 transition-colors"
                  style={{ colorScheme: "dark" }}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Comentario (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  rows={2}
                  placeholder="Detalles adicionales..."
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors resize-none"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-xl text-[13px] font-medium text-white cursor-pointer transition-all hover:brightness-110 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(180deg, rgba(122,134,224,0.18) 0%, rgba(122,134,224,0.1) 100%)",
                  border: "1px solid rgba(122,134,224,0.3)",
                  borderTop: "1px solid rgba(122,134,224,0.5)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.3)",
                }}
              >
                Siguiente <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* ── Step 2: Fuente & Cliente ── */}
          {step === 2 && (
            <>
              {/* Source type */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Fuente de la venta</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {Object.entries(SOURCE_LABEL).map(([k, label]) => {
                    const active = form.source_type === k;
                    return (
                      <button
                        key={k}
                        onClick={() => { set("source_type", k); set("source_label", ""); set("reel_id", ""); set("story_sequence_id", ""); }}
                        className={`py-2 rounded-xl text-[10px] font-medium text-center cursor-pointer transition-all ${active ? "text-white" : "text-white/30 hover:text-white/55"}`}
                        style={active
                          ? {
                              background: SOURCE_BG[k],
                              border: `1px solid ${SOURCE_HEX[k]}66`,
                              borderTop: `1px solid ${SOURCE_HEX[k]}99`,
                              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.3)`,
                            }
                          : { border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reel picker */}
              {form.source_type === "reel" && (
                <div className="space-y-2">
                  <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Reel que generó la venta</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por caption..."
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2.5 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                    />
                  </div>
                  <div
                    className="space-y-0.5 max-h-[180px] overflow-y-auto rounded-xl"
                    style={{ border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}
                  >
                    {filtered.map(r => (
                      <button
                        key={r.id}
                        onClick={() => set("reel_id", r.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all text-left ${form.reel_id === r.id ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                      >
                        <div className="h-9 w-6 rounded overflow-hidden shrink-0 bg-white/[0.04]">
                          {r.thumbnail_url
                            ? <Image src={r.thumbnail_url} alt="" width={24} height={36} className="object-cover w-full h-full" />
                            : <Play className="h-3 w-3 text-white/20 m-auto mt-2" />}
                        </div>
                        <span className="text-[11px] font-light text-white/60 truncate flex-1 leading-snug">
                          {r.caption?.slice(0, 65) || "Sin título"}
                        </span>
                        {form.reel_id === r.id && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#4BCEAF" }} />}
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-[11px] text-white/25 text-center py-4">Sin resultados</p>
                    )}
                  </div>
                </div>
              )}

              {/* Historia: story sequence picker */}
              {form.source_type === "historia" && (
                <div className="space-y-2">
                  <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Historia que generó la venta</label>
                  {stories.length > 0 ? (
                    <div
                      className="space-y-0.5 max-h-[200px] overflow-y-auto rounded-xl"
                      style={{ border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}
                    >
                      {stories.map(seq => {
                        const selected = form.story_sequence_id === seq.id;
                        const date = new Date(seq.published_at);
                        const dateStr = date.toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                        return (
                          <button
                            key={seq.id}
                            onClick={() => {
                              set("story_sequence_id", seq.id);
                              set("source_label", `Historia del ${dateStr}`);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all text-left ${selected ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                          >
                            <div className="h-10 w-7 rounded overflow-hidden shrink-0 bg-white/[0.04]">
                              {seq.first_thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={seq.first_thumbnail} alt="" className="object-cover w-full h-full" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Play className="h-3 w-3 text-white/15" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-light text-white/60 leading-snug">{dateStr}</p>
                              <p className="text-[9px] text-white/25 mt-0.5">
                                {seq.slide_count} slide{seq.slide_count !== 1 ? "s" : ""} · {seq.total_impressions.toLocaleString()} imp. · {seq.total_reach.toLocaleString()} alcance
                              </p>
                            </div>
                            {selected && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#4BCEAF" }} />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      value={form.source_label}
                      onChange={e => set("source_label", e.target.value)}
                      placeholder="Describí la historia..."
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                    />
                  )}
                </div>
              )}

              {/* Post: text */}
              {form.source_type === "post" && (
                <div className="space-y-2">
                  <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Post que generó la venta</label>
                  <input
                    value={form.source_label}
                    onChange={e => set("source_label", e.target.value)}
                    placeholder="Describí el post..."
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              )}

              {/* Link en Bio: platform select */}
              {form.source_type === "link_bio" && (
                <div className="space-y-2">
                  <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Plataforma del link</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["YouTube", "Instagram"].map(p => {
                      const active = form.source_label === p;
                      return (
                        <button
                          key={p}
                          onClick={() => set("source_label", p)}
                          className={`py-2.5 rounded-xl text-[11px] cursor-pointer transition-all ${active ? "text-white" : "text-white/30 hover:text-white/55"}`}
                          style={active
                            ? {
                                background: "linear-gradient(180deg, rgba(235,105,145,0.16) 0%, rgba(235,105,145,0.08) 100%)",
                                border: "1px solid rgba(235,105,145,0.32)",
                                borderTop: "1px solid rgba(235,105,145,0.5)",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                              }
                            : { border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Otro: text */}
              {form.source_type === "otro" && (
                <div className="space-y-2">
                  <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Describí la fuente</label>
                  <input
                    value={form.source_label}
                    onChange={e => set("source_label", e.target.value)}
                    placeholder="Referido, evento, DM directo..."
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              )}

              {/* Client */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Cliente (opcional)</label>
                <input
                  value={form.client_name}
                  onChange={e => set("client_name", e.target.value)}
                  placeholder="Nombre del cliente..."
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {error && <p className="text-[11px] text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl text-[12px] text-white/40 hover:text-white/60 cursor-pointer transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                >
                  ← Atrás
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white cursor-pointer transition-all hover:brightness-110 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(180deg, rgba(122,134,224,0.22) 0%, rgba(122,134,224,0.12) 100%)",
                    border: "1px solid rgba(122,134,224,0.32)",
                    borderTop: "1px solid rgba(122,134,224,0.52)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.3)",
                  }}
                >
                  {loading ? "Guardando..." : "Guardar venta"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function SalesTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[11px]"
      style={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
    >
      <p className="text-white/40 mb-0.5">{label}</p>
      <p className="font-light" style={{ color: "#7A86E0" }}>{fmtMoney(payload[0].value)}</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VentasClient({ initialSales, reelsForPicker, storiesForPicker }: VentasClientProps) {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [showModal, setShowModal] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("mes");
  const [customRange, setCustomRange] = useState<DateRange>({ from: "", to: "" });

  // Date filtering
  const activeRange = datePreset === "custom" ? customRange : getPresetRange(datePreset);
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

  // Monthly chart (last 6 months)
  const monthlyMap = new Map<string, number>();
  activeSales.forEach(s => {
    const key = s.sale_date.slice(0, 7);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + s.amount_total);
  });
  const chartData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => {
      const [y, m] = month.split("-");
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      return { label: d.toLocaleString("es", { month: "short" }).replace(".", ""), amount };
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
      <div className="mb-8 animate-slide-up stagger-1">
        <DateRangeFilter
          preset={datePreset}
          range={customRange}
          onPreset={setDatePreset}
          onRange={setCustomRange}
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

          {/* Monthly chart */}
          {chartData.length > 0 && (
            <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-2">
              <h3 className="text-[13px] font-light text-white/80 mb-5">Facturación mensual</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}K` : v}`}
                    />
                    <Tooltip content={<SalesTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={28}>
                      {chartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === chartData.length - 1 ? "#7A86E0" : "rgba(122,134,224,0.32)"}
                        />
                      ))}
                    </Bar>
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
                  className="grid grid-cols-12 gap-2 text-[10px] text-white/25 uppercase tracking-[0.1em] pb-2.5 px-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="col-span-4">Fuente / Cliente</div>
                  <div className="col-span-2 text-right">Facturación</div>
                  <div className="col-span-2 text-right">Recolectado</div>
                  <div className="col-span-2 text-center">Tipo</div>
                  <div className="col-span-2 text-center">Estado</div>
                </div>

                {filteredSales.map((s) => (
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
                            background: SOURCE_BG[s.source_type] ?? "rgba(255,255,255,0.04)",
                            color: SOURCE_HEX[s.source_type] ?? "rgba(255,255,255,0.3)",
                          }}
                        >
                          {SOURCE_LABEL[s.source_type]?.[0] ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-light text-white/70 truncate leading-snug">
                          {s.reels?.caption?.slice(0, 40) ||
                            s.source_label?.slice(0, 40) ||
                            SOURCE_LABEL[s.source_type] ||
                            "Venta"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-[9px] px-1.5 py-[2px] rounded-full font-medium"
                            style={{
                              color: SOURCE_HEX[s.source_type] ?? "rgba(255,255,255,0.3)",
                              background: SOURCE_BG[s.source_type] ?? "rgba(255,255,255,0.04)",
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

                    {/* Collected */}
                    <div className="col-span-2 text-right text-[12px] font-light" style={{ color: "#4BCEAF" }}>
                      {fmtMoney(s.amount_collected)}
                    </div>

                    {/* Payment type */}
                    <div className="col-span-2 text-center">
                      <span className="text-[9px] text-white/30">
                        {PAYMENT_LABEL[s.payment_type] ?? s.payment_type}
                      </span>
                    </div>

                    {/* Status + delete */}
                    <div className="col-span-2 flex items-center justify-center gap-2">
                      <span className={`text-[9px] font-medium px-2 py-1 rounded-full ${STATUS_COLOR[s.payment_status] ?? "text-white/40 bg-white/[0.05]"}`}>
                        {STATUS_LABEL[s.payment_status] ?? s.payment_status}
                      </span>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white/20 hover:text-red-400 shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
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
                      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
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
                          <div className="h-[2px] mt-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
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
        <NewSaleModal
          reels={reelsForPicker}
          stories={storiesForPicker}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
