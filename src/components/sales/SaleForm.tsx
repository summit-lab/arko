"use client";

import { useState, useMemo, useRef } from "react";
import Image from "next/image";
import { Search, Check, X, Play, ArrowRight } from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Sale {
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

export interface ReelPicker {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
}

export interface StoryPicker {
  id: string;
  published_at: string;
  total_impressions: number;
  total_reach: number;
  slide_count: number;
  first_thumbnail: string | null;
}

export type SaleSourceType = "reel" | "historia" | "post" | "link_bio" | "otro";

export interface SaleFormProps {
  reels: ReelPicker[];
  stories: StoryPicker[];
  onSuccess: (sale: Sale) => void;
  onCancel?: () => void;
  defaultSourceType?: SaleSourceType;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const PAYMENT_LABEL: Record<string, string> = {
  full: "Pago completo",
  cuotas: "Cuotas",
  deposito: "Depósito/Seña",
};

const SOURCE_LABEL: Record<SaleSourceType, string> = {
  reel: "Reel",
  historia: "Historia",
  post: "Post",
  link_bio: "Link en Bio",
  otro: "Otro",
};

const SOURCE_HEX: Record<SaleSourceType, string> = {
  reel: "#7A86E0",
  historia: "#AF6EC7",
  post: "#4BCEAF",
  link_bio: "#EB6991",
  otro: "#9B9BA8",
};

const SOURCE_BG: Record<SaleSourceType, string> = {
  reel: "rgba(122,134,224,0.12)",
  historia: "rgba(175,110,199,0.12)",
  post: "rgba(75,206,175,0.12)",
  link_bio: "rgba(235,105,145,0.12)",
  otro: "rgba(155,155,168,0.12)",
};

const buildEmptyForm = (defaultSourceType: SaleSourceType) => ({
  reel_id: "",
  story_sequence_id: "",
  source_type: defaultSourceType as string,
  source_label: "",
  amount_total: "",
  n_cuotas: "3",
  amount_collected: "",
  expected_date: "",
  first_installment_date: "",
  payment_type: "full",
  sale_date: new Date().toISOString().split("T")[0],
  notes: "",
  client_name: "",
});

// Cuántas cuotas ya vencieron a hoy, dadas fecha de la primera cuota y N total.
// Cuota i (0..n-1) vence en first + i*30 días. Cuenta las que tengan due ≤ hoy.
function countDueByToday(firstDateStr: string, n: number): number {
  if (!firstDateStr) return 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const firstMs = new Date(`${firstDateStr}T00:00:00Z`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  if (firstMs > todayMs) return 0;
  const diffDays = Math.floor((todayMs - firstMs) / 86_400_000);
  return Math.min(n, Math.floor(diffDays / 30) + 1);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SaleForm({ reels, stories, onSuccess, onCancel, defaultSourceType = "reel" }: SaleFormProps) {
  const ct = useChartTheme();
  const [form, setForm] = useState(() => buildEmptyForm(defaultSourceType));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  // Synchronous re-entry guard. `loading` is async (React batches state
  // updates), so rapid clicks can fire two fetches before the disabled
  // flag flips. A ref we mutate before awaiting blocks the duplicate.
  const submittingRef = useRef(false);

  const filtered = useMemo(
    () => reels.filter(r => (r.caption ?? "").toLowerCase().includes(search.toLowerCase())),
    [reels, search]
  );

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const amountTotal = parseFloat(form.amount_total) || 0;
  const nCuotas = Math.max(1, parseInt(form.n_cuotas) || 1);
  const perCuota = amountTotal > 0 ? Math.round(amountTotal / nCuotas) : 0;
  // Para cuotas:
  //   - Venta retroactiva (sale_date < hoy) → asumimos que el cliente ya
  //     cobró las N cuotas. El endpoint marca todas como paid al crear.
  //   - Venta actual/futura → efectivo recolectado = perCuota × cuotas
  //     vencidas según fecha. El cron diario va marcando paid a medida que
  //     vencen el resto.
  const firstInstallmentDate = form.first_installment_date || form.sale_date;
  const todayStr = new Date().toISOString().split("T")[0];
  const isRetroactive = form.sale_date < todayStr;
  const paidCuotasCount =
    form.payment_type !== "cuotas"
      ? 0
      : isRetroactive
      ? nCuotas
      : countDueByToday(firstInstallmentDate, nCuotas);
  const amountCollected =
    form.payment_type === "full"
      ? amountTotal
      : form.payment_type === "cuotas"
      ? (isRetroactive ? amountTotal : paidCuotasCount * perCuota)
      : (parseFloat(form.amount_collected) || 0);
  const amountPending = Math.max(0, amountTotal - amountCollected);

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
    if (submittingRef.current) return;
    if (!amountTotal || amountTotal <= 0) { setError("Ingresá un monto válido"); return; }
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reel_id: form.reel_id || null,
          story_sequence_id: form.story_sequence_id || null,
          source_type: form.source_type,
          source_label: form.source_label || null,
          amount_total: amountTotal,
          amount_collected: amountCollected,
          payment_type: form.payment_type,
          payment_status: derivedStatus(),
          sale_date: form.sale_date,
          payment_method: null,
          notes: buildNotes(),
          client_name: form.client_name || null,
          client_contact: null,
          // Solo para cuotas: el endpoint genera las filas en sale_installments.
          n_cuotas: form.payment_type === "cuotas" ? nCuotas : undefined,
          first_installment_date:
            form.payment_type === "cuotas" ? firstInstallmentDate : undefined,
        }),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const saved = await res.json() as Sale;
      const reel = reels.find(r => r.id === form.reel_id);
      onSuccess({
        ...saved,
        reels: reel
          ? { id: reel.id, caption: reel.caption, thumbnail_url: reel.thumbnail_url, permalink: null }
          : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-0 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.07] shrink-0">
        <div>
          <h3 className="text-[15px] font-light text-white">Nueva Venta</h3>
          <p className="text-[11px] text-white/30 mt-0.5">
            Paso {step} de 2 — {step === 1 ? "Información de la venta" : "Fuente & Cliente"}
          </p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-white/25 hover:text-white/60 cursor-pointer transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex px-6 pt-4 gap-1.5 shrink-0">
        {[1, 2].map(n => (
          <div
            key={n}
            className="flex-1 h-[2px] rounded-full transition-all duration-300"
            style={{ background: step >= n ? "#7A86E0" : ct.mutedSurface }}
          />
        ))}
      </div>

      <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">

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
                        : { border: `1px solid ${ct.panelBorder}`, background: ct.subtleSurface }}
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
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-foreground font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
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
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-foreground font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
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
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-3 text-[15px] text-foreground font-light outline-none focus:border-white/20 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Valor por cuota</label>
                    <div className="rounded-xl px-3 py-3 text-[15px] text-white/35 font-light bg-white/[0.02] border border-white/[0.05]">
                      {perCuota > 0 ? fmtMoney(perCuota) : "—"}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Fecha de la primera cuota</label>
                  <input
                    type="date"
                    value={form.first_installment_date}
                    onChange={e => set("first_installment_date", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-3 text-[12px] text-foreground outline-none focus:border-white/20 transition-colors"
                  />
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    Las siguientes cuotas se generan cada 30 días. Si la dejás vacía, usa la fecha de venta.
                  </p>
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
                      <span className="text-white/40">
                        Efectivo recolectado
                        {isRetroactive && form.payment_type === "cuotas" && (
                          <span className="text-white/25 ml-1.5">({nCuotas}/{nCuotas} cuotas)</span>
                        )}
                      </span>
                      <span style={{ color: "#4BCEAF" }}>{fmtMoney(amountCollected)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] pt-2 border-t border-white/[0.06]">
                      <span className="text-white/40">Por cobrar</span>
                      <span style={{ color: "#EB6991" }}>{fmtMoney(amountPending)}</span>
                    </div>
                    {isRetroactive && form.payment_type === "cuotas" && (
                      <p className="text-[10px] text-white/40 leading-relaxed pt-1 border-t border-white/[0.06]">
                        Venta retroactiva: todas las cuotas se marcarán como cobradas al crear. Si alguna no se cobró, podés desmarcarla después desde el detalle.
                      </p>
                    )}
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
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-foreground font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
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
                        className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-7 pr-3 py-3 text-[15px] text-foreground font-light placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Cobro restante estimado</label>
                    <input
                      type="date"
                      value={form.expected_date}
                      onChange={e => set("expected_date", e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-3 text-[12px] text-foreground outline-none focus:border-white/20 transition-colors"
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
                    <div className="flex justify-between text-[11px] pt-2 border-t border-white/[0.06]">
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
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-foreground outline-none focus:border-white/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Comentario (opcional)</label>
              <textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                rows={2}
                placeholder="Detalles adicionales..."
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-foreground placeholder:text-white/20 outline-none focus:border-white/20 transition-colors resize-none"
              />
            </div>

          </>
        )}

        {/* ── Step 2: Fuente & Cliente ── */}
        {step === 2 && (
          <>
            {/* Source type */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/35 uppercase tracking-[0.1em]">Fuente de la venta</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.entries(SOURCE_LABEL) as Array<[SaleSourceType, string]>).map(([k, label]) => {
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
                        : { border: `1px solid ${ct.panelBorder}`, background: ct.subtleSurface }}
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
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2.5 text-[12px] text-foreground placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                  />
                </div>
                <div
                  className="space-y-0.5 max-h-[180px] overflow-y-auto rounded-xl border border-white/[0.05] bg-white/[0.02]"
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
                    className="space-y-0.5 max-h-[200px] overflow-y-auto rounded-xl border border-white/[0.05] bg-white/[0.02]"
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
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-foreground placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
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
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-foreground placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
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
                          : { border: `1px solid ${ct.panelBorder}`, background: ct.subtleSurface }}
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
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-foreground placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
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
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[12px] text-foreground placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
              />
            </div>

          </>
        )}
      </div>

      {/* Footer — sticky con botones */}
      <div className="px-6 py-4 border-t border-white/[0.07] shrink-0 space-y-3">
        {step === 2 && error && <p className="text-[11px] text-red-400">{error}</p>}

        {step === 1 && (
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
        )}

        {step === 2 && (
          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl text-[12px] text-white/40 hover:text-white/60 cursor-pointer transition-colors bg-white/[0.025] border border-white/[0.08]"
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
        )}
      </div>
    </div>
  );
}
