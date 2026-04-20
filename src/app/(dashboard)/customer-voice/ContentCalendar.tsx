"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  Instagram, Youtube, Globe, X, Check,
} from "lucide-react";
import { addContentPlanItem, deleteContentPlanItem } from "./actions";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalendarReel {
  id: string;
  published_at: string;
  views_total: number;
  caption: string | null;
  performer_multiple: number | null;
  thumbnail_url: string | null;
  permalink: string | null;
}

export interface CalendarPlanItem {
  id: string;
  planned_date: string;
  title: string;
  description: string | null;
  platform: string;
  content_type: string | null;
  status: string;
}

interface Props {
  currentMonth: string; // "YYYY-MM"
  publishedReels: CalendarReel[];
  planItems: CalendarPlanItem[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function getMonthGrid(year: number, monthIdx: number) {
  const firstDay = new Date(year, monthIdx, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanItemRow({ item }: { item: CalendarPlanItem }) {
  const [isDeleting, startDeleting] = useTransition();

  const colors = {
    instagram: { border: "border-pink-500/20", bg: "bg-pink-500/[0.08]", text: "text-pink-400" },
    youtube:   { border: "border-red-500/20",  bg: "bg-red-500/[0.08]",  text: "text-red-400" },
    tiktok:    { border: "border-cyan-500/20", bg: "bg-cyan-500/[0.08]", text: "text-cyan-400" },
    general:   { border: "border-violet-500/20", bg: "bg-violet-500/[0.08]", text: "text-violet-400" },
  }[item.platform] ?? { border: "border-white/10", bg: "bg-white/[0.04]", text: "text-white/50" };

  const statusLabel = { idea: "Idea", in_progress: "En progreso", ready: "Listo", published: "Publicado" }[item.status] ?? item.status;
  const statusStyle = {
    idea: "bg-white/[0.06] text-white/30",
    in_progress: "bg-amber-500/20 text-amber-300",
    ready: "bg-emerald-500/20 text-emerald-300",
    published: "bg-violet-500/20 text-violet-300",
  }[item.status] ?? "bg-white/[0.06] text-white/30";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-opacity ${colors.bg} ${colors.border} ${isDeleting ? "opacity-40" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-medium uppercase tracking-wide ${colors.text}`}>
            {item.platform}
          </span>
          {item.content_type && (
            <span className="text-[9px] text-white/20">· {item.content_type}</span>
          )}
        </div>
        <p className="text-[13px] text-white/75 font-medium leading-snug">{item.title}</p>
        {item.description && (
          <p className="text-[11px] text-white/35 font-light mt-1 leading-snug">{item.description}</p>
        )}
        <span className={`inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded font-medium ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>
      <button
        onClick={() => startDeleting(async () => { await deleteContentPlanItem(item.id); })}
        disabled={isDeleting}
        className="h-6 w-6 rounded-md hover:bg-white/[0.08] flex items-center justify-center text-white/20 hover:text-rose-400 transition-all cursor-pointer shrink-0 mt-0.5"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function AddPlanForm({ date, onClose }: { date: string; onClose: () => void }) {
  const [isSubmitting, startSubmitting] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("planned_date", date);
    startSubmitting(async () => {
      await addContentPlanItem(formData);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">Nueva idea</p>

      <input
        name="title"
        required
        placeholder="Título del contenido..."
        autoFocus
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-white/20 focus:outline-none focus:border-white/[0.2]"
      />

      <textarea
        name="description"
        placeholder="Notas o descripción (opcional)..."
        rows={2}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-white/20 focus:outline-none focus:border-white/[0.2] resize-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          name="platform"
          defaultValue="instagram"
          className="bg-background border border-white/[0.08] rounded-lg px-2 py-2 text-[12px] text-foreground/60 focus:outline-none focus:border-white/[0.2]"
        >
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="general">General</option>
        </select>

        <select
          name="content_type"
          defaultValue=""
          className="bg-background border border-white/[0.08] rounded-lg px-2 py-2 text-[12px] text-foreground/60 focus:outline-none focus:border-white/[0.2]"
        >
          <option value="">Tipo...</option>
          <option value="reel">Reel</option>
          <option value="post">Post</option>
          <option value="story">Story</option>
          <option value="video">Video</option>
          <option value="short">Short</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-[12px] text-violet-300 font-medium transition-all cursor-pointer disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {isSubmitting ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="py-2 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12px] text-white/30 hover:text-white/60 transition-all cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContentCalendar({ currentMonth, publishedReels, planItems }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigating] = useTransition();

  const [year, monthNum] = currentMonth.split("-").map(Number);
  const monthIdx = monthNum - 1; // 0-based

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  // Index data by date
  const reelsByDate = new Map<string, CalendarReel[]>();
  publishedReels.forEach((r) => {
    const key = r.published_at.split("T")[0];
    if (!reelsByDate.has(key)) reelsByDate.set(key, []);
    reelsByDate.get(key)!.push(r);
  });

  const planByDate = new Map<string, CalendarPlanItem[]>();
  planItems.forEach((p) => {
    if (!planByDate.has(p.planned_date)) planByDate.set(p.planned_date, []);
    planByDate.get(p.planned_date)!.push(p);
  });

  function applyFilter<T extends object>(arr: T[]) {
    return filterPlatform === "all" ? arr : arr.filter((i) => (i as { platform?: string }).platform === filterPlatform);
  }

  function navigate(delta: number) {
    const d = new Date(year, monthIdx + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedDate(null);
    setShowAddForm(false);
    startNavigating(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", newMonth);
      router.replace(`/customer-voice?${params.toString()}`, { scroll: false });
    });
  }

  const cells = getMonthGrid(year, monthIdx);

  const selectedReels = selectedDate ? applyFilter(reelsByDate.get(selectedDate) ?? []) as CalendarReel[] : [];
  const selectedPlan = selectedDate ? applyFilter(planByDate.get(selectedDate) ?? []) as CalendarPlanItem[] : [];
  const selectedIsPast = selectedDate ? selectedDate < todayStr : false;

  function handleDayClick(dateStr: string) {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setShowAddForm(false);
    } else {
      setSelectedDate(dateStr);
      setShowAddForm(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Top controls */}
      <div className="flex items-center justify-between">
        {/* Platform filter */}
        <div className="flex items-center gap-1">
          {[
            { id: "all", label: "Todos", Icon: Globe },
            { id: "instagram", label: "Instagram", Icon: Instagram },
            { id: "youtube", label: "YouTube", Icon: Youtube },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setFilterPlatform(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer ${
                filterPlatform === id
                  ? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
                  : "text-white/30 hover:text-white/55 border border-transparent hover:bg-white/[0.03]"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/80 transition-all cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className={`text-[14px] font-medium text-white/80 min-w-[148px] text-center transition-opacity duration-150 ${isNavigating ? "opacity-40" : ""}`}>
            {MONTHS_ES[monthIdx]} {year}
          </span>
          <button
            onClick={() => navigate(1)}
            className="h-8 w-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/80 transition-all cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar + Detail panel layout */}
      <div className={`grid gap-5 items-start ${selectedDate ? "2xl:grid-cols-[1fr_360px]" : ""}`}>

        {/* Calendar grid */}
        <div className="glass-panel rounded-xl overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-white/[0.05]">
            {DAYS_ES.map((d) => (
              <div key={d} className="py-2.5 text-center text-[10px] text-white/20 font-medium uppercase tracking-[0.1em]">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <div
                    key={i}
                    className="h-[130px] border-b border-r border-white/[0.03]"
                  />
                );
              }

              const dateStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
              const dayReels = applyFilter(reelsByDate.get(dateStr) ?? []) as CalendarReel[];
              const dayPlan = applyFilter(planByDate.get(dateStr) ?? []) as CalendarPlanItem[];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isPastDay = dateStr < todayStr;
              const hasContent = dayReels.length > 0 || dayPlan.length > 0;

              return (
                <div
                  key={i}
                  onClick={() => handleDayClick(dateStr)}
                  className={`
                    h-[130px] border-b border-r border-white/[0.03] p-2 cursor-pointer
                    transition-colors duration-150 relative flex flex-col
                    ${isSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}
                  `}
                >
                  {/* Day number */}
                  <div className={`
                    text-[12px] font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full shrink-0
                    ${isToday
                      ? "bg-violet-500 text-white text-[11px]"
                      : isSelected ? "text-white/90"
                      : isPastDay ? "text-white/35"
                      : "text-white/60"
                    }
                  `}>
                    {day}
                  </div>

                  {/* Content items */}
                  <div className="flex flex-col gap-1 overflow-hidden flex-1">
                    {/* Published reels */}
                    {dayReels.slice(0, 2).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start gap-1.5 px-1.5 py-1 rounded-[4px] bg-emerald-500/[0.1] border border-emerald-500/15"
                      >
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 mt-0.5 ${(r.performer_multiple ?? 0) >= 3 ? "bg-amber-400" : "bg-emerald-400"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] text-emerald-300/80 font-medium leading-none truncate">
                            {fmt(r.views_total)} views
                          </p>
                          {r.caption && (
                            <p className="text-[8px] text-white/30 leading-snug mt-0.5 truncate">
                              {r.caption.slice(0, 28)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {dayReels.length > 2 && (
                      <p className="text-[8px] text-white/15 px-1.5">+{dayReels.length - 2} más</p>
                    )}

                    {/* Plan items */}
                    {dayPlan.slice(0, 2).map((p) => (
                      <div
                        key={p.id}
                        className={`px-1.5 py-1 rounded-[4px] border ${
                          p.platform === "instagram" ? "bg-pink-500/[0.08] border-pink-500/15" :
                          p.platform === "youtube"   ? "bg-red-500/[0.08] border-red-500/15" :
                          "bg-violet-500/[0.08] border-violet-500/15"
                        }`}
                      >
                        <p className="text-[9px] text-white/50 truncate leading-none font-medium">{p.title}</p>
                        <p className={`text-[8px] mt-0.5 leading-none ${
                          p.platform === "instagram" ? "text-pink-400/50" :
                          p.platform === "youtube"   ? "text-red-400/50" :
                          "text-violet-400/50"
                        }`}>{p.platform}</p>
                      </div>
                    ))}
                    {dayPlan.length > 2 && (
                      <p className="text-[8px] text-white/15 px-1.5">+{dayPlan.length - 2} ideas</p>
                    )}
                  </div>

                  {/* "+" for empty future days */}
                  {!isPastDay && !isToday && !hasContent && (
                    <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                      <Plus className="h-3.5 w-3.5 text-white/15" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDate && (
          <div className="glass-panel rounded-xl p-5 space-y-4">
            {/* Panel header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-[0.1em] font-medium mb-0.5">
                  {DAYS_ES[new Date(`${selectedDate}T12:00:00`).getDay()]}
                </p>
                <h3 className="text-[17px] font-medium text-white/90">
                  {parseInt(selectedDate.split("-")[2])} de {MONTHS_ES[monthIdx]}
                </h3>
              </div>
              <button
                onClick={() => { setSelectedDate(null); setShowAddForm(false); }}
                className="h-7 w-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/25 hover:text-white/60 transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Published reels */}
            {selectedReels.length > 0 && (
              <div>
                <p className="text-[10px] text-white/20 uppercase tracking-[0.1em] font-medium mb-2">Publicado</p>
                <div className="space-y-2">
                  {selectedReels.map((r) => (
                    <Link
                      key={r.id}
                      href={`/instagram/${r.id}`}
                      className="block rounded-xl overflow-hidden border border-white/[0.07] hover:border-white/[0.14] bg-white/[0.02] hover:bg-white/[0.05] transition-all group"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-full overflow-hidden bg-black/30" style={{ aspectRatio: "9/14" }}>
                        {r.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.thumbnail_url}
                            alt={r.caption ?? "Reel"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-500/[0.05]">
                            <Instagram className="h-8 w-8 text-emerald-400/20" />
                          </div>
                        )}
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        {/* Views badge */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                          <span className="text-[12px] text-white/90 font-semibold">{fmt(r.views_total)} views</span>
                          {r.performer_multiple != null && r.performer_multiple >= 3 && (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded-md border border-amber-400/30 backdrop-blur-sm">
                              ×{r.performer_multiple.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {/* Top right: IG icon */}
                        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                          <Instagram className="h-3 w-3 text-white/60" />
                        </div>
                      </div>
                      {/* Caption */}
                      {r.caption && (
                        <div className="px-3 py-2">
                          <p className="text-[11px] text-white/50 leading-snug group-hover:text-white/70 transition-colors">
                            {r.caption.slice(0, 60)}{r.caption.length > 60 ? "…" : ""}
                          </p>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Planned items */}
            {selectedPlan.length > 0 && (
              <div>
                <p className="text-[10px] text-white/20 uppercase tracking-[0.1em] font-medium mb-2">Planificado</p>
                <div className="space-y-2">
                  {selectedPlan.map((p) => (
                    <PlanItemRow key={p.id} item={p} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {selectedReels.length === 0 && selectedPlan.length === 0 && !showAddForm && (
              <div className="py-3 text-center">
                <p className="text-[13px] text-white/20 font-light">
                  {selectedIsPast ? "Sin publicaciones este día" : "Día libre — podés planificar algo"}
                </p>
              </div>
            )}

            {/* Add form */}
            {showAddForm && (
              <AddPlanForm date={selectedDate} onClose={() => setShowAddForm(false)} />
            )}

            {/* Add idea button */}
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/[0.1] text-[12px] text-white/25 hover:text-white/55 hover:border-white/[0.22] hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar idea
              </button>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-[10px] text-white/20">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Reel publicado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <span>Top performer ×3+</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-pink-400" />
          <span>Idea IG</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span>Idea YT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-violet-500" />
          <span>Hoy</span>
        </div>
      </div>
    </div>
  );
}
