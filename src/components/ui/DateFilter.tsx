"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, Check } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  parseISO,
  eachDayOfInterval,
} from "date-fns";
import { es, enUS } from "date-fns/locale";
import { DATE_PRESETS, type DatePreset, type DateRange } from "@/types/date-filter";
import { resolvePreset, buildCustomRange, toDateStr, dateRangeToParams } from "@/lib/date-utils";

// ─── Calendar Grid ───────────────────────────────────────────────────────────

function CalendarGrid({
  selecting,
  rangeFrom,
  rangeTo,
  onSelect,
}: {
  selecting: "from" | "to";
  rangeFrom: Date | null;
  rangeTo: Date | null;
  onSelect: (d: Date) => void;
}) {
  const t = useTranslations("dateFilter.calendar");
  const locale = useLocale();
  const dfnsLocale = locale === "en" ? enUS : es;
  const dayHeaders = t.raw("daysShort") as string[];
  const [viewMonth, setViewMonth] = useState(() => rangeTo ?? rangeFrom ?? new Date());
  const today = new Date();

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const isInRange = (d: Date) => {
    if (!rangeFrom || !rangeTo) return false;
    return (isAfter(d, rangeFrom) || isSameDay(d, rangeFrom)) &&
           (isBefore(d, rangeTo) || isSameDay(d, rangeTo));
  };

  const isStart = (d: Date) => rangeFrom ? isSameDay(d, rangeFrom) : false;
  const isEnd = (d: Date) => rangeTo ? isSameDay(d, rangeTo) : false;

  return (
    <div className="select-none" onClick={(e) => e.stopPropagation()}>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setViewMonth(subMonths(viewMonth, 1)); }}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-medium text-foreground capitalize">
          {format(viewMonth, "MMMM yyyy", { locale: dfnsLocale })}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setViewMonth(addMonths(viewMonth, 1)); }}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isToday = isSameDay(day, today);
          const inRange = isInRange(day);
          const start = isStart(day);
          const end = isEnd(day);
          const isFuture = isAfter(day, today) || isSameDay(day, today);

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={(e) => { e.stopPropagation(); if (!isFuture) onSelect(day); }}
              disabled={isFuture}
              className={`
                relative h-8 text-[12px] transition-all duration-150 cursor-pointer
                ${!inMonth ? "text-muted-foreground/40" : isFuture ? "text-muted-foreground/50 cursor-not-allowed" : "text-foreground/80 hover:text-foreground"}
                ${inRange && !start && !end ? "bg-violet-500/20" : ""}
                ${start || end ? "bg-violet-500/40 text-foreground font-medium" : ""}
                ${start ? "rounded-l-md" : ""}
                ${end ? "rounded-r-md" : ""}
                ${!inRange && !start && !end ? "hover:bg-accent rounded-md" : ""}
                ${isToday && !start && !end ? "ring-1 ring-border rounded-md" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {/* Selecting indicator */}
      <div className="mt-3 text-[11px] text-muted-foreground text-center">
        {selecting === "from" ? t("selectFrom") : t("selectTo")}
      </div>
    </div>
  );
}

// ─── Main DateFilter Component ───────────────────────────────────────────────

interface DateFilterUrlProps {
  mode: "url";
  defaultPreset?: DatePreset;
  preserveParams?: string[];
  onChange?: never;
}

interface DateFilterStateProps {
  mode: "state";
  defaultPreset?: DatePreset;
  onChange: (range: DateRange) => void;
  preserveParams?: never;
}

type DateFilterProps = (DateFilterUrlProps | DateFilterStateProps) & {
  className?: string;
};

export function DateFilter({ mode, defaultPreset = "30d", className, ...rest }: DateFilterProps) {
  // Hooks must be called unconditionally — unused in "state" mode but that's fine
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useTranslations("dateFilter");
  const tCal = useTranslations("dateFilter.calendar");
  const locale = useLocale();
  const dfnsLocale = locale === "en" ? enUS : es;

  /** Inline replacement for the Spanish-only rangeLabel helper. */
  function localeRangeLabel(range: DateRange): string {
    if (range.preset === "custom") {
      return `${format(parseISO(range.from), "d MMM", { locale: dfnsLocale })} – ${format(parseISO(range.to), "d MMM", { locale: dfnsLocale })}`;
    }
    return t(`rangeLabel.${range.preset}` as `rangeLabel.${Exclude<DatePreset, "custom">}`);
  }

  const getInitialRange = useCallback((): DateRange => {
    if (mode === "url" && searchParams) {
      const days = searchParams.get("days");
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const preset = searchParams.get("preset");
      if (from && to) {
        if (preset && preset !== "custom") return resolvePreset(preset as DatePreset);
        return buildCustomRange(from, to);
      }
      if (days) {
        const d = parseInt(days, 10);
        const presetMap: Record<number, DatePreset> = { 1: "ayer", 7: "7d", 14: "14d", 30: "30d", 90: "90d" };
        if (presetMap[d]) return resolvePreset(presetMap[d]);
      }
    }
    return resolvePreset(defaultPreset);
  }, [mode, searchParams, defaultPreset]);

  const [activeRange, setActiveRange] = useState<DateRange>(getInitialRange);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"presets" | "calendar">("presets");
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [tempFrom, setTempFrom] = useState<Date | null>(null);
  const [tempTo, setTempTo] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setView("presets");
      }
    }
    // Use click (not mousedown) so inner clicks register first
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isOpen]);

  const applyRange = useCallback((range: DateRange) => {
    setActiveRange(range);
    setIsOpen(false);
    setView("presets");

    if (mode === "url" && router) {
      window.dispatchEvent(new Event("nav:start"));
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete("days");
      params.delete("from");
      params.delete("to");
      params.delete("preset");
      const newParams = new URLSearchParams(dateRangeToParams(range));
      newParams.forEach((v, k) => params.set(k, v));
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    } else if (mode === "state" && (rest as DateFilterStateProps).onChange) {
      (rest as DateFilterStateProps).onChange(range);
    }
  }, [mode, router, searchParams, rest]);

  const handlePreset = useCallback((preset: DatePreset) => {
    if (preset === "custom") {
      setTempFrom(parseISO(activeRange.from));
      setTempTo(parseISO(activeRange.to));
      setSelecting("from");
      setView("calendar");
      return;
    }
    applyRange(resolvePreset(preset));
  }, [activeRange, applyRange]);

  const handleCalendarSelect = useCallback((d: Date) => {
    if (selecting === "from") {
      setTempFrom(d);
      setSelecting("to");
      if (tempTo && isAfter(d, tempTo)) {
        setTempTo(null);
      }
    } else {
      if (tempFrom && isBefore(d, tempFrom)) {
        setTempTo(tempFrom);
        setTempFrom(d);
      } else {
        setTempTo(d);
      }
    }
  }, [selecting, tempFrom, tempTo]);

  const handleApplyCustom = useCallback(() => {
    if (!tempFrom || !tempTo) return;
    applyRange(buildCustomRange(toDateStr(tempFrom), toDateStr(tempTo)));
  }, [tempFrom, tempTo, applyRange]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className ?? ""}`}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer hover:brightness-110 bg-accent/60 border border-border text-foreground/85"
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          minWidth: 200,
          padding: "10px 16px",
        }}
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left">{localeRangeLabel(activeRange)}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* ── Dropdown Panel ── */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1.5 rounded-xl overflow-hidden bg-popover border border-border text-popover-foreground shadow-2xl"
          style={{
            zIndex: 9999,
            minWidth: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {view === "presets" ? (
            /* ── Presets List ── */
            <div className="py-2" style={{ minWidth: "100%" }}>
              {DATE_PRESETS.map((p) => {
                const isActive = activeRange.preset === p.key;
                const isCustomEntry = p.key === "custom";
                return (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => handlePreset(p.key)}
                    className={`
                      w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors cursor-pointer
                      ${isActive && !isCustomEntry ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}
                      ${isCustomEntry ? "border-t border-border mt-1 pt-3" : ""}
                    `}
                  >
                    <span>{t(`presets.${p.key}`)}</span>
                    {isActive && !isCustomEntry && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                    {isCustomEntry && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Calendar View ── */
            <div className="p-4" style={{ width: 296 }}>
              {/* Back to presets */}
              <button
                type="button"
                onClick={() => setView("presets")}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4 cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {tCal("back")}
              </button>

              {/* Range display */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setSelecting("from")}
                  className={`flex-1 text-center py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                    selecting === "from"
                      ? "bg-violet-500/25 text-violet-700 dark:text-violet-300 border border-violet-500/30"
                      : "bg-accent text-muted-foreground border border-border hover:bg-accent/70"
                  }`}
                >
                  {tempFrom ? format(tempFrom, "d MMM yyyy", { locale: dfnsLocale }) : tCal("fromLabel")}
                </button>
                <span className="text-muted-foreground text-[12px]">→</span>
                <button
                  type="button"
                  onClick={() => setSelecting("to")}
                  className={`flex-1 text-center py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                    selecting === "to"
                      ? "bg-violet-500/25 text-violet-700 dark:text-violet-300 border border-violet-500/30"
                      : "bg-accent text-muted-foreground border border-border hover:bg-accent/70"
                  }`}
                >
                  {tempTo ? format(tempTo, "d MMM yyyy", { locale: dfnsLocale }) : tCal("toLabel")}
                </button>
              </div>

              <CalendarGrid
                selecting={selecting}
                rangeFrom={tempFrom}
                rangeTo={tempTo}
                onSelect={handleCalendarSelect}
              />

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setView("presets")}
                  className="flex-1 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground bg-accent hover:bg-accent/70 transition-colors cursor-pointer"
                >
                  {tCal("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!tempFrom || !tempTo}
                  className="flex-1 py-2 rounded-lg text-[12px] font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {tCal("apply")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
