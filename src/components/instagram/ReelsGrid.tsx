"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HeartIcon, BookmarkSimpleIcon, ChatCircleIcon, ShareNetworkIcon,
  PlayIcon, ClockIcon, ArrowUpRightIcon, MegaphoneIcon, WarningIcon,
  UserPlusIcon, CaretDownIcon, ArrowsDownUpIcon, CheckIcon,
} from "@phosphor-icons/react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reel {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  views_total: number;
  views_org: number;
  views_paid: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  follows: number;
  duration_seconds: number | null;
  reel_type: string | null;
  has_ads: boolean;
  performer_multiple: number | null;
}

interface ReelsGridProps {
  reels: Reel[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
}

// ─── Filter config ────────────────────────────────────────────────────────────

type SortKey = "views_total" | "views_org" | "likes" | "saves" | "comments" | "shares" | "performer_multiple" | "published_at";
type SortDir = "desc" | "asc";
type TypeFilter = "all" | "trial" | "normal";
type DistFilter = "all" | "organic" | "promoted";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "published_at", label: "Fecha" },
  { value: "views_total", label: "Views totales" },
  { value: "views_org", label: "Views orgánico" },
  { value: "likes", label: "Likes" },
  { value: "saves", label: "Guardados" },
  { value: "comments", label: "Comentarios" },
  { value: "shares", label: "Compartidos" },
  { value: "performer_multiple", label: "Multiplicador" },
];

// ─── Select component ─────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/8"
      >
        <span>{selected?.label}</span>
        <CaretDownIcon size={12} weight="bold" className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-2xl shadow-black/50 backdrop-blur-2xl">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-6 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-white/8 ${
                o.value === value ? "text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>{o.label}</span>
              {o.value === value && <CheckIcon size={12} weight="bold" className="text-white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toggle pill ──────────────────────────────────────────────────────────────

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
        active
          ? "bg-white/15 text-white border border-white/20"
          : "bg-white/5 text-zinc-400 border border-white/8 hover:bg-white/8 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

const PAGE_SIZE = 12;

// ─── Main component ───────────────────────────────────────────────────────────

export function ReelsGrid({ reels }: ReelsGridProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [distFilter, setDistFilter] = useState<DistFilter>("all");
  const [page, setPage] = useState(1);

  // Reset pagination when filters/sort change
  useEffect(() => {
    setPage(1);
  }, [sortKey, sortDir, typeFilter, distFilter]);

  const filtered = useMemo(() => {
    let result = [...reels];

    // Filtro tipo
    if (typeFilter === "trial") result = result.filter((r) => r.reel_type === "trial_likely");
    if (typeFilter === "normal") result = result.filter((r) => r.reel_type !== "trial_likely");

    // Filtro distribución
    if (distFilter === "organic") result = result.filter((r) => !r.has_ads && r.views_paid === 0);
    if (distFilter === "promoted") result = result.filter((r) => r.has_ads || r.views_paid > 0);

    // Ordenar
    result.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (sortKey === "published_at") {
        aVal = a.published_at ? new Date(a.published_at).getTime() : 0;
        bVal = b.published_at ? new Date(b.published_at).getTime() : 0;
      } else if (sortKey === "performer_multiple") {
        aVal = a.performer_multiple ?? 0;
        bVal = b.performer_multiple ?? 0;
      } else {
        aVal = a[sortKey] as number;
        bVal = b[sortKey] as number;
      }

      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [reels, sortKey, sortDir, typeFilter, distFilter]);

  return (
    <div>
      {/* Header + filtros */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">Reels</h2>
            <span className="text-[11px] text-zinc-500">
              {Math.min(page * PAGE_SIZE, filtered.length)} de {reels.length}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-zinc-500">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-5 rounded bg-gradient-to-r from-blue-400 to-cyan-500" />x3+
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-5 rounded bg-gradient-to-r from-emerald-400 to-green-500" />x5+
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-5 rounded bg-gradient-to-r from-amber-400 to-yellow-500" />x8+
            </div>
          </div>
        </div>

        {/* Barra de filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Ordenar por */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 whitespace-nowrap">Ordenar por</span>
            <Select
              value={sortKey}
              onChange={(v) => setSortKey(v as SortKey)}
              options={SORT_OPTIONS}
              className="w-40"
            />
          </div>

          {/* Dirección */}
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-zinc-200 text-[11px] font-medium rounded-lg px-3 py-1.5 hover:bg-white/8 hover:border-white/20 transition-colors"
          >
            <ArrowsDownUpIcon size={12} weight="bold" />
            {sortDir === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
          </button>

          <div className="h-4 w-px bg-white/10" />

          {/* Tipo */}
          <div className="flex items-center gap-1">
            <Pill active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>Todos</Pill>
            <Pill active={typeFilter === "trial"} onClick={() => setTypeFilter("trial")}>Trial</Pill>
            <Pill active={typeFilter === "normal"} onClick={() => setTypeFilter("normal")}>No Trial</Pill>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Distribución */}
          <div className="flex items-center gap-1">
            <Pill active={distFilter === "all"} onClick={() => setDistFilter("all")}>Todos</Pill>
            <Pill active={distFilter === "organic"} onClick={() => setDistFilter("organic")}>Orgánico</Pill>
            <Pill active={distFilter === "promoted"} onClick={() => setDistFilter("promoted")}>Promocionado</Pill>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-zinc-500 text-sm">
            No hay reels que coincidan con los filtros seleccionados.
          </div>
        )}
        {filtered.slice(0, page * PAGE_SIZE).map((reel) => {
          const multiple = reel.performer_multiple || 0;
          const isPromotedReel = reel.has_ads || reel.views_paid > 0;
          const pillLabel = `x${multiple.toFixed(1)}`;
          const pillStyle =
            multiple >= 8
              ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-black"
              : multiple >= 5
              ? "bg-gradient-to-r from-emerald-400 to-green-500 text-black"
              : multiple >= 3
              ? "bg-gradient-to-r from-blue-400 to-cyan-500 text-black"
              : multiple >= 1
              ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
              : multiple >= 0.5
              ? "bg-zinc-500/20 border border-zinc-500/30 text-zinc-300"
              : "bg-red-500/20 border border-red-500/30 text-red-300";
          const glowColor =
            multiple >= 8 ? "rgba(251,191,36,0.08)"
            : multiple >= 5 ? "rgba(52,211,153,0.08)"
            : multiple >= 3 ? "rgba(96,165,250,0.06)"
            : "transparent";
          const captionPreview = reel.caption
            ? reel.caption.length > 76
              ? reel.caption.slice(0, 76) + "..."
              : reel.caption
            : "Sin caption";
          const durationStr = reel.duration_seconds
            ? `${Math.floor(reel.duration_seconds / 60)}:${String(reel.duration_seconds % 60).padStart(2, "0")}`
            : "--";


          return (
            <Link
              key={reel.id}
              href={`/instagram/${reel.id}`}
              prefetch
              onMouseEnter={() => router.prefetch(`/instagram/${reel.id}`)}
              onFocus={() => router.prefetch(`/instagram/${reel.id}`)}
              className="group relative flex flex-row overflow-hidden rounded-2xl border border-white/[0.08] transition-all duration-300 min-h-[180px]"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.04) 100%)",
                backdropFilter: "blur(12px)",
                boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${glowColor}`,
              }}
            >
              {/* Glass shimmer top */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] z-10"
                style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.2) 70%, transparent 100%)" }} />
              <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)" }} />

              {/* ── Thumbnail 9:16 a la izquierda ── */}
              <div className="relative w-[110px] shrink-0 self-stretch overflow-hidden bg-zinc-900">
                {reel.thumbnail_url ? (
                  <img src={reel.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayIcon size={20} weight="fill" className="text-white/10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
                {/* Duration */}
                <div className="absolute bottom-1.5 left-1 right-1 flex items-center justify-center gap-0.5 rounded bg-black/70 py-0.5 text-[8px] text-white/70 backdrop-blur-sm">
                  <ClockIcon size={7} weight="fill" />
                  {durationStr}
                </div>
              </div>

              {/* ── Contenido derecho ── */}
              <div className="flex min-w-0 flex-1 flex-col justify-between p-3 gap-2">

                {/* Fila top: badges + flecha */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1 min-w-0">
                    {multiple > 0 && (
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold leading-none ${pillStyle}`}>{pillLabel}</span>
                    )}
                    {reel.reel_type === "trial_likely" && (
                      <span className="flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] leading-none text-amber-300">
                        <WarningIcon size={8} weight="fill" />Trial
                      </span>
                    )}
                    {isPromotedReel && (
                      <span className="flex items-center gap-0.5 rounded border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.5 text-[9px] leading-none text-purple-300">
                        <MegaphoneIcon size={8} weight="fill" />Ads
                      </span>
                    )}
                  </div>
                  <ArrowUpRightIcon size={12} className="shrink-0 text-zinc-600 group-hover:text-white transition-colors" />
                </div>

                {/* Título */}
                <p className="line-clamp-1 text-[11px] font-medium leading-snug text-zinc-200">{captionPreview}</p>

                {/* Views */}
                <div className="flex items-end justify-between">
                  <span className="text-[22px] font-bold tracking-tight text-white leading-none">{formatNumber(reel.views_total)}</span>
                  <span className="text-[9px] text-zinc-500">{reel.published_at ? timeAgo(reel.published_at) : "--"}</span>
                </div>

                {/* Distribución org / pago */}
                <div className="space-y-1">
                  <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    {isPromotedReel ? (
                      <div className="flex h-full w-full">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.round((reel.views_org / reel.views_total) * 100)}%` }} />
                        <div className="h-full bg-purple-500" style={{ width: `${Math.round((reel.views_paid / reel.views_total) * 100)}%` }} />
                      </div>
                    ) : (
                      <div className="h-full w-full bg-emerald-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[8px]">
                    <span className="text-emerald-600">{formatNumber(reel.views_org)} org</span>
                    {isPromotedReel && <span className="text-purple-500">{formatNumber(reel.views_paid)} pago</span>}
                  </div>
                </div>

                {/* Métricas discretas */}
                <div className="flex items-center gap-3 border-t border-white/[0.05] pt-2">
                  {[
                    { value: reel.likes, icon: HeartIcon, color: "text-zinc-500" },
                    { value: reel.saves, icon: BookmarkSimpleIcon, color: "text-zinc-500" },
                    { value: reel.comments, icon: ChatCircleIcon, color: "text-zinc-500" },
                    { value: reel.shares, icon: ShareNetworkIcon, color: "text-zinc-500" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <m.icon size={10} weight="fill" className={m.color} />
                      <span className="text-[10px] text-zinc-500">{formatNumber(m.value)}</span>
                    </div>
                  ))}
                  {reel.follows > 0 && (
                    <div className="ml-auto flex items-center gap-1 text-[9px] text-cyan-500">
                      <UserPlusIcon size={9} weight="fill" />
                      +{reel.follows}
                    </div>
                  )}
                </div>

              </div>
            </Link>
          );
        })}
      </div>

      {/* Mostrar más */}
      {filtered.length > page * PAGE_SIZE && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-5 py-2 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white cursor-pointer"
          >
            Mostrar más
            <span className="text-zinc-500 text-[11px]">
              ({Math.min(PAGE_SIZE, filtered.length - page * PAGE_SIZE)} más)
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
