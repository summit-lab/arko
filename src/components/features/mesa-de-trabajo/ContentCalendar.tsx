"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_TYPES, CONTENT_STATUSES } from "@/types/content-plan";
import type { ContentItem, ContentType, ContentStatus, CalendarReel } from "@/types/content-plan";

interface ContentCalendarProps {
  items: ContentItem[];
  publishedReels: CalendarReel[];
  typeFilter: ContentType | "all";
  onCardClick: (item: ContentItem) => void;
  onAddOnDate: (date: string) => void;
}

const DAY_KEYS   = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

function pad(n: number) { return String(n).padStart(2, "0"); }

function getIgPillStyle(type: CalendarReel["type"], isLight: boolean) {
  switch (type) {
    case "carousel":
      return {
        bg:    isLight ? "rgba(99,102,241,0.12)"  : "rgba(99,102,241,0.20)",
        text:  isLight ? "rgba(67,56,202,0.90)"   : "rgba(165,180,252,0.95)",
      };
    case "story":
      return {
        bg:    isLight ? "rgba(251,146,60,0.12)"  : "rgba(251,146,60,0.20)",
        text:  isLight ? "rgba(194,65,12,0.90)"   : "rgba(253,186,116,0.95)",
      };
    default:
      return {
        bg:    isLight ? "rgba(225,48,108,0.10)"  : "rgba(225,48,108,0.18)",
        text:  isLight ? "rgba(180,20,80,0.85)"   : "rgba(255,150,180,0.9)",
      };
  }
}

export function ContentCalendar({
  items,
  publishedReels,
  typeFilter,
  onCardClick,
  onAddOnDate,
}: ContentCalendarProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const router = useRouter();
  const t = useTranslations("mesaDeTrabajo");

  const getPillLabel = (type: CalendarReel["type"]) =>
    t(`calendar.pillLabel.${type === "carousel" ? "carousel" : type === "story" ? "story" : "reel"}` as
      "calendar.pillLabel.carousel" | "calendar.pillLabel.story" | "calendar.pillLabel.reel");

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const filtered = typeFilter === "all" ? items : items.filter((i) => i.content_type === typeFilter);
  const filteredReels = typeFilter === "all" ? publishedReels : publishedReels.filter((r) => r.type === typeFilter);

  // Group content plan items by date
  const byDate: Record<string, ContentItem[]> = {};
  for (const item of filtered) {
    if (!item.planned_date) continue;
    const key = item.planned_date.slice(0, 10);
    (byDate[key] ??= []).push(item);
  }

  // Group published IG items by date
  const reelsByDate: Record<string, CalendarReel[]> = {};
  for (const reel of filteredReels) {
    (reelsByDate[reel.date] ??= []).push(reel);
  }

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cells       = Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstDay + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  function prevMonth() { month === 0  ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1); }
  function nextMonth() { month === 11 ? (setMonth(0),  setYear(y => y + 1)) : setMonth(m => m + 1); }

  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Theme tokens
  const border      = isLight ? "rgba(17,17,17,0.08)"   : "rgba(255,255,255,0.07)";
  const textMain    = isLight ? "#111111"                : "rgba(255,255,255,0.85)";
  const textSub     = isLight ? "rgba(17,17,17,0.40)"   : "rgba(255,255,255,0.35)";
  const cellEmptyBg = isLight ? "rgba(17,17,17,0.01)"   : "rgba(255,255,255,0.01)";
  const cellBg      = isLight ? "white"                 : "rgba(255,255,255,0.02)";
  const headerBg    = isLight ? "rgba(17,17,17,0.03)"   : "rgba(255,255,255,0.02)";


  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{ color: textSub }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[14px] font-medium min-w-[160px] text-center" style={{ color: textMain }}>
          {t(`calendar.months.${MONTH_KEYS[month]}` as `calendar.months.${typeof MONTH_KEYS[number]}`)} {year}
        </span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{ color: textSub }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
        {/* Day headers */}
        <div className="grid grid-cols-7" style={{ background: headerBg, borderBottom: `1px solid ${border}` }}>
          {DAY_KEYS.map((d) => (
            <div key={d} className="py-2.5 text-center text-[11px] font-semibold tracking-widest uppercase" style={{ color: textSub }}>
              {t(`calendar.days.${d}` as `calendar.days.${typeof DAY_KEYS[number]}`)}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const isLastRow = idx >= totalCells - 7;
            const isLastCol = (idx + 1) % 7 === 0;

            if (!day) {
              return (
                <div
                  key={`e-${idx}`}
                  style={{
                    minHeight: 120,
                    background: cellEmptyBg,
                    borderBottom: isLastRow ? "none" : `1px solid ${border}`,
                    borderRight:  isLastCol ? "none" : `1px solid ${border}`,
                  }}
                />
              );
            }

            const key      = `${year}-${pad(month + 1)}-${pad(day)}`;
            const dayItems = byDate[key] ?? [];
            const dayReels = reelsByDate[key] ?? [];
            const isToday  = key === todayKey;
            const hasContent = dayItems.length > 0 || dayReels.length > 0;

            return (
              <div
                key={key}
                className="flex flex-col p-1.5 group/cell transition-colors"
                style={{
                  minHeight: 120,
                  background: hasContent ? cellBg : "transparent",
                  borderBottom: isLastRow ? "none" : `1px solid ${border}`,
                  borderRight:  isLastCol ? "none" : `1px solid ${border}`,
                }}
                onMouseEnter={(e) => !hasContent && ((e.currentTarget as HTMLElement).style.background = cellEmptyBg)}
                onMouseLeave={(e) => !hasContent && ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                {/* Day number row */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="w-6 h-6 text-[12px] font-medium flex items-center justify-center rounded-full"
                    style={{
                      background: isToday ? (isLight ? "#111111" : "rgba(255,255,255,0.9)") : "transparent",
                      color: isToday ? (isLight ? "white" : "black") : textSub,
                    }}
                  >
                    {day}
                  </span>
                  <button
                    onClick={() => onAddOnDate(key)}
                    className="w-5 h-5 rounded flex items-center justify-center transition-all opacity-0 group-hover/cell:opacity-100"
                    style={{ color: textSub }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
                  >
                    <Plus size={11} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Content plan items */}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayItems.slice(0, 2).map((item) => {
                    const typeMeta   = CONTENT_TYPES.find((tp) => tp.value === item.content_type);
                    const statusMeta = CONTENT_STATUSES.find((s) => s.value === item.status);
                    const typeLabel  = typeMeta ? t(`type.${typeMeta.value}` as `type.${ContentType}`) : item.content_type;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onCardClick(item)}
                        className="w-full text-left rounded px-1.5 py-1 text-[10px] font-medium leading-snug truncate transition-opacity hover:opacity-75"
                        style={{
                          background: isLight
                            ? statusMeta?.color.replace(/0\.\d+\)$/, "0.12)") ?? "rgba(17,17,17,0.06)"
                            : statusMeta?.color ?? "rgba(255,255,255,0.06)",
                          color: isLight ? "#111111" : "rgba(255,255,255,0.78)",
                        }}
                        title={`${statusMeta ? t(`status.${statusMeta.value}` as `status.${ContentStatus}`) + " · " : ""}${item.title}`}
                      >
                        {typeLabel} · {item.title}
                      </button>
                    );
                  })}

                  {/* Published IG items — clickable, color by type */}
                  {dayReels.slice(0, 2).map((reel) => {
                    const pill = getIgPillStyle(reel.type, isLight);
                    const pillLabel = getPillLabel(reel.type);
                    return reel.href ? (
                      <button
                        key={reel.id}
                        onClick={() => router.push(reel.href!)}
                        className="w-full text-left rounded px-1.5 py-1 text-[10px] font-medium leading-snug truncate transition-opacity hover:opacity-75"
                        style={{ background: pill.bg, color: pill.text }}
                        title={reel.caption}
                      >
                        {pillLabel} · {reel.caption}
                      </button>
                    ) : (
                      <div
                        key={reel.id}
                        className="w-full rounded px-1.5 py-1 text-[10px] font-medium leading-snug truncate"
                        style={{ background: pill.bg, color: pill.text }}
                        title={reel.caption}
                      >
                        {pillLabel} · {reel.caption}
                      </div>
                    );
                  })}

                  {(dayItems.length + dayReels.length) > 4 && (
                    <span className="text-[10px] px-1.5" style={{ color: textSub }}>
                      {t("calendar.legend.moreCount", { count: dayItems.length + dayReels.length - 4 })}
                    </span>
                  )}
                  {dayItems.length > 2 && dayReels.length === 0 && (
                    <span className="text-[10px] px-1.5" style={{ color: textSub }}>
                      {t("calendar.legend.moreCount", { count: dayItems.length - 2 })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.10)" }} />
          <span className="text-[11px]" style={{ color: textSub }}>{t("calendar.legend.planned")}</span>
        </div>
        {(["reel", "carousel", "story"] as const).map((tp) => {
          const p = getIgPillStyle(tp, isLight);
          return (
            <div key={tp} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.bg }} />
              <span className="text-[11px]" style={{ color: textSub }}>{getPillLabel(tp)} {t("calendar.legend.publishedSuffix")}</span>
            </div>
          );
        })}
        {(() => {
          const n = filtered.filter((i) => !i.planned_date).length;
          return n > 0 ? (
            <span className="text-[11px] ml-auto" style={{ color: textSub }}>
              {t("calendar.legend.noDate", { count: n })}
            </span>
          ) : null;
        })()}
      </div>
    </div>
  );
}
