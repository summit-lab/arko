"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  DollarSign, Plus, TrendingUp, Clock, X, Check,
  ChevronDown, Search, Trash2, Play,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
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

interface VentasClientProps {
  initialSales: Sale[];
  reelsForPicker: ReelPicker[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const STATUS_LABEL: Record<string, string> = { collected: "Cobrado", cancelled: "Cancelado", pending: "Pendiente" };
const STATUS_COLOR: Record<string, string> = { collected: "text-emerald-400 bg-emerald-400/10", cancelled: "text-red-400 bg-red-400/10", pending: "text-amber-400 bg-amber-400/10" };
const TYPE_LABEL: Record<string, string> = { full: "Full Payment", cuotas: "Cuotas", deposito: "Depósito/Seña" };
const SOURCE_LABEL: Record<string, string> = { reel: "Reel", historia: "Historia", post: "Post", otro: "Otro" };
const METHOD_OPTIONS = ["Transferencia", "Mercado Pago", "Efectivo", "Tarjeta", "Crypto", "Otro"];

// ─── New sale form ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  reel_id: "",
  source_type: "reel",
  source_label: "",
  amount_total: "",
  amount_collected: "",
  payment_type: "full",
  payment_status: "collected",
  sale_date: new Date().toISOString().split("T")[0],
  payment_method: "",
  notes: "",
  client_name: "",
  client_contact: "",
};

function NewSaleModal({ reels, onClose, onSaved }: {
  reels: ReelPicker[];
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

  const amountTotal = parseFloat(form.amount_total) || 0;
  const amountCollected = parseFloat(form.amount_collected) || 0;
  const amountPending = Math.max(0, amountTotal - amountCollected);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!amountTotal || amountTotal <= 0) { setError("Ingresá un monto válido"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reel_id: form.reel_id || null,
          source_type: form.source_type,
          source_label: form.source_label || null,
          amount_total: amountTotal,
          amount_collected: amountCollected || amountTotal,
          payment_type: form.payment_type,
          payment_status: form.payment_status,
          sale_date: form.sale_date,
          payment_method: form.payment_method || null,
          notes: form.notes || null,
          client_name: form.client_name || null,
          client_contact: form.client_contact || null,
        }),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const saved = await res.json() as Sale;
      // Attach reel data if selected
      const reel = reels.find(r => r.id === form.reel_id);
      onSaved({ ...saved, reels: reel ? { id: reel.id, caption: reel.caption, thumbnail_url: reel.thumbnail_url, permalink: null } : null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "rgba(10,10,18,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-light text-white">Nueva Venta</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white cursor-pointer transition-colors"><X className="h-4 w-4" /></button>
        </div>

        {/* Steps */}
        <div className="flex gap-2 text-[11px]">
          {[{ n: 1, label: "Contenido & Fuente" }, { n: 2, label: "Montos & Pago" }].map(s => (
            <button key={s.n} onClick={() => setStep(s.n as 1|2)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${step === s.n ? "text-white" : "text-white/30 hover:text-white/55"}`}
              style={step === s.n ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" } : undefined}>
              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step >= s.n ? "bg-white/20 text-white" : "bg-white/5 text-white/30"}`}>{s.n}</span>
              {s.label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <>
            {/* Content source type */}
            <div className="space-y-2">
              <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Fuente de la venta</label>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(SOURCE_LABEL).map(([k, label]) => (
                  <button key={k} onClick={() => set("source_type", k)}
                    className={`px-2 py-2 rounded-lg text-[11px] font-medium text-center cursor-pointer transition-all ${form.source_type === k ? "text-white" : "text-white/30 hover:text-white/55"}`}
                    style={form.source_type === k ? { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" } : { border: "1px solid rgba(255,255,255,0.06)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reel picker (if source = reel) */}
            {form.source_type === "reel" && (
              <div className="space-y-2">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Reel que generó la venta</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por caption..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20"
                  />
                </div>
                <div className="space-y-1 max-h-[180px] overflow-y-auto">
                  {filtered.map(r => (
                    <button key={r.id} onClick={() => set("reel_id", r.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all text-left ${form.reel_id === r.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
                      <div className="h-9 w-6 rounded overflow-hidden shrink-0 bg-white/[0.04]">
                        {r.thumbnail_url ? <Image src={r.thumbnail_url} alt="" width={24} height={36} className="object-cover w-full h-full" /> : <Play className="h-3 w-3 text-white/20 m-auto mt-2" />}
                      </div>
                      <span className="text-[11px] font-light text-white/60 truncate flex-1">{r.caption?.slice(0, 60) || "Sin título"}</span>
                      {form.reel_id === r.id && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="text-[11px] text-white/25 text-center py-3">Sin resultados</p>}
                </div>
              </div>
            )}

            {/* Client name */}
            <div className="space-y-2">
              <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Cliente (opcional)</label>
              <input value={form.client_name} onChange={e => set("client_name", e.target.value)}
                placeholder="Nombre del cliente..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>

            <button onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl text-[13px] font-medium text-white cursor-pointer transition-all hover:brightness-110"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              Siguiente →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Monto total</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-[12px]">$</span>
                  <input type="number" value={form.amount_total} onChange={e => set("amount_total", e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-6 pr-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Cobrado hasta hoy</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-[12px]">$</span>
                  <input type="number" value={form.amount_collected} onChange={e => set("amount_collected", e.target.value)}
                    placeholder={form.amount_total || "0"}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-6 pr-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                </div>
              </div>
            </div>

            {/* Pending preview */}
            {amountTotal > 0 && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.12)" }}>
                <span className="text-[11px] text-amber-400/70">Por cobrar</span>
                <span className="text-[16px] font-light text-amber-300">{fmtMoney(amountPending)}</span>
              </div>
            )}

            {/* Payment type */}
            <div className="space-y-2">
              <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Tipo de pago</label>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(TYPE_LABEL).map(([k, label]) => (
                  <button key={k} onClick={() => set("payment_type", k)}
                    className={`px-2 py-2 rounded-lg text-[11px] font-medium text-center cursor-pointer transition-all ${form.payment_type === k ? "text-white" : "text-white/30 hover:text-white/55"}`}
                    style={form.payment_type === k ? { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" } : { border: "1px solid rgba(255,255,255,0.06)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status + method */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Estado</label>
                <div className="relative">
                  <select value={form.payment_status} onChange={e => set("payment_status", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-white/20 appearance-none cursor-pointer">
                    <option value="collected">Cobrado</option>
                    <option value="pending">Pendiente</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Método de pago</label>
                <div className="relative">
                  <select value={form.payment_method} onChange={e => set("payment_method", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-white/20 appearance-none cursor-pointer">
                    <option value="">Seleccionar...</option>
                    {METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Fecha de venta</label>
              <input type="date" value={form.sale_date} onChange={e => set("sale_date", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-white/20" />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-[11px] text-white/40 uppercase tracking-[0.08em]">Notas (opcional)</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
                placeholder="Detalles adicionales..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none focus:border-white/20 resize-none" />
            </div>

            {error && <p className="text-[11px] text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl text-[13px] text-white/40 hover:text-white/60 cursor-pointer transition-colors border border-white/[0.06]">
                ← Atrás
              </button>
              <button onClick={handleSave} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white cursor-pointer transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)" }}>
                {loading ? "Guardando..." : "Guardar venta"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function SalesTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] px-3 py-2 text-[11px]"
      style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(20px)" }}>
      <p className="text-white/40 mb-0.5">{label}</p>
      <p className="text-emerald-300 font-light">{fmtMoney(payload[0].value)}</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VentasClient({ initialSales, reelsForPicker }: VentasClientProps) {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [showModal, setShowModal] = useState(false);

  // KPIs
  const activeSales = sales.filter(s => s.payment_status !== "cancelled");
  const totalRevenue = activeSales.reduce((s, v) => s + v.amount_total, 0);
  const totalCollected = activeSales.reduce((s, v) => s + v.amount_collected, 0);
  const totalPending = totalRevenue - totalCollected;
  const salesWithReel = activeSales.filter(s => s.reels);

  // Monthly chart
  const monthlyMap = new Map<string, number>();
  activeSales.forEach(s => {
    const key = s.sale_date.slice(0, 7); // YYYY-MM
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
      {/* Header */}
      <div className="animate-slide-up mb-8 flex items-start justify-between">
        <div>
          <h1 className="page-title">Ventas</h1>
          <p className="text-white/35 mt-3 text-[15px] font-light">Revenue generado desde tu contenido.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium text-white cursor-pointer transition-all hover:brightness-110"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.22)" }}
        >
          <Plus className="h-4 w-4 text-emerald-400" />
          Agregar venta
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-5 mb-8 animate-slide-up stagger-1">
        {[
          { label: "Revenue Total", value: fmtMoney(totalRevenue), sub: `${activeSales.length} ventas`, icon: DollarSign, color: "text-emerald-400", bgColor: "rgba(52,211,153,0.08)" },
          { label: "Cash Collected", value: fmtMoney(totalCollected), sub: totalRevenue > 0 ? `${Math.round((totalCollected / totalRevenue) * 100)}% del total` : "—", icon: TrendingUp, color: "text-violet-400", bgColor: "rgba(139,92,246,0.08)" },
          { label: "Por Cobrar", value: fmtMoney(totalPending), sub: "pendiente de cobro", icon: Clock, color: "text-amber-400", bgColor: "rgba(251,191,36,0.08)" },
        ].map((k) => (
          <div key={k.label} className="glass-card px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] font-medium text-white/40 uppercase tracking-[0.08em]">{k.label}</p>
              <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: k.bgColor }}>
                <k.icon className={`h-[17px] w-[17px] ${k.color}`} />
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
              <h3 className="text-[14px] font-light text-white mb-5">Revenue mensual</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v/1000)}K` : v}`} />
                    <Tooltip content={<SalesTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={28}>
                      {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? "#34d399" : "rgba(52,211,153,0.4)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sales table */}
          <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-3">
            <h3 className="text-[14px] font-light text-white mb-5">Historial de ventas</h3>
            {sales.length === 0 ? (
              <div className="py-12 text-center">
                <DollarSign className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-[13px] text-white/25 font-light">No hay ventas registradas aún</p>
                <button onClick={() => setShowModal(true)} className="mt-4 text-[12px] text-emerald-400/70 hover:text-emerald-400 cursor-pointer transition-colors">
                  + Agregar primera venta
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] text-white/30 uppercase tracking-[0.1em] pb-2 border-b border-white/[0.06] px-2">
                  <div className="col-span-4">Contenido / Fuente</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-2 text-right">Cobrado</div>
                  <div className="col-span-1 text-center">Tipo</div>
                  <div className="col-span-1 text-center">Estado</div>
                  <div className="col-span-1 text-right">Fecha</div>
                  <div className="col-span-1" />
                </div>
                {sales.map((s) => (
                  <div key={s.id} className="grid grid-cols-12 gap-2 items-center py-3 px-2 rounded-lg hover:bg-white/[0.03] transition-all group">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      {s.reels?.thumbnail_url ? (
                        <div className="relative h-9 w-6 rounded overflow-hidden shrink-0">
                          <Image src={s.reels.thumbnail_url} alt="" fill className="object-cover" sizes="24px" />
                        </div>
                      ) : (
                        <div className="h-9 w-6 rounded bg-white/[0.04] shrink-0 flex items-center justify-center">
                          <Play className="h-3 w-3 text-white/20" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-light text-white/70 truncate">
                          {s.reels?.caption?.slice(0, 45) || SOURCE_LABEL[s.source_type] || "Venta"}
                        </p>
                        {s.client_name && <p className="text-[9px] text-white/30 truncate">{s.client_name}</p>}
                      </div>
                    </div>
                    <div className="col-span-2 text-right text-[13px] font-light text-white">{fmtMoney(s.amount_total)}</div>
                    <div className="col-span-2 text-right text-[13px] font-light text-emerald-400">{fmtMoney(s.amount_collected)}</div>
                    <div className="col-span-1 text-center text-[10px] text-white/40">{TYPE_LABEL[s.payment_type] ?? s.payment_type}</div>
                    <div className="col-span-1 text-center">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLOR[s.payment_status] ?? "text-white/40 bg-white/[0.05]"}`}>
                        {STATUS_LABEL[s.payment_status] ?? s.payment_status}
                      </span>
                    </div>
                    <div className="col-span-1 text-right text-[11px] text-white/30">{fmtDate(s.sale_date)}</div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => handleDelete(s.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white/20 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: top content with sales ── */}
        {salesWithReel.length > 0 && (
          <div className="w-[280px] shrink-0 space-y-4 animate-slide-up stagger-2">
            <div className="glass-panel rounded-xl p-5">
              <h3 className="text-[12px] font-medium text-white/40 uppercase tracking-[0.1em] mb-4">Top Contenido</h3>
              <div className="space-y-3">
                {salesWithReel
                  .sort((a, b) => b.amount_total - a.amount_total)
                  .slice(0, 8)
                  .map((s, i) => (
                    <div key={s.id} className="flex items-start gap-2.5">
                      <span className="text-[10px] text-white/20 w-4 shrink-0 mt-0.5">{i + 1}</span>
                      {s.reels?.thumbnail_url && (
                        <div className="relative h-10 w-7 rounded overflow-hidden shrink-0">
                          <Image src={s.reels.thumbnail_url} alt="" fill className="object-cover" sizes="28px" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-light text-white/55 truncate">
                          {s.reels?.caption?.slice(0, 40) || "Sin título"}
                        </p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[11px] text-emerald-300 font-light">{fmtMoney(s.amount_total)}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_COLOR[s.payment_status] ?? ""}`}>
                            {STATUS_LABEL[s.payment_status]}
                          </span>
                        </div>
                        {/* Mini bar */}
                        <div className="h-[2px] mt-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <div className="h-full rounded-full bg-emerald-400/50"
                            style={{ width: `${Math.round((s.amount_total / (salesWithReel[0]?.amount_total || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewSaleModal
          reels={reelsForPicker}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
