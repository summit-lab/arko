"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { es } from "date-fns/locale";
import { DATE_PRESETS, type DatePreset, type DateRange } from "@/types/date-filter";
import { resolvePreset, buildCustomRange, rangeLabel, toDateStr, dateRangeToParams } from "@/lib/date-utils";

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
          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-medium text-white/80 capitalize">
          {format(viewMonth, "MMMM yyyy", { locale: es })}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setViewMonth(addMonths(viewMonth, 1)); }}
          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-white/30 py-1">
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
                ${!inMonth ? "text-white/10" : isFuture ? "text-white/15 cursor-not-allowed" : "text-white/60 hover:text-white"}
                ${inRange && !start && !end ? "bg-violet-500/20" : ""}
                ${start || end ? "bg-violet-500/40 text-white font-medium" : ""}
                ${start ? "rounded-l-md" : ""}
                ${end ? "rounded-r-md" : ""}
                ${!inRange && !start && !end ? "hover:bg-white/[0.08] rounded-md" : ""}
                ${isToday && !start && !end ? "ring-1 ring-white/25 rounded-md" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {/* Selecting indicator */}
      <div className="mt-3 text-[11px] text-white/35 text-center">
        {selecting === "from" ? "Seleccioná fecha inicio" : "Seleccioná fecha fin"}
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
  const router = mode === "url" ? useRouter() : null;
  const searchParams = mode === "url" ? useSearchParams() : null;
  const [, startTransition] = useTransition();

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
        className="flex items-center gap-2 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer hover:brightness-110"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.75)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          minWidth: 200,
          padding: "10px 16px",
        }}
      >
        <Calendar className="h-4 w-4 text-white/40" />
        <span className="flex-1 text-left">{rangeLabel(activeRange)}</span>
        <ChevronDown className={`h-4 w-4 text-white/30 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* ── Dropdown Panel ── */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1.5 rounded-xl overflow-hidden"
          style={{
            zIndex: 9999,
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
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
                      ${isActive && !isCustomEntry ? "text-white bg-white/[0.06]" : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"}
                      ${isCustomEntry ? "border-t border-white/[0.06] mt-1 pt-3" : ""}
                    `}
                  >
                    <span>{p.label}</span>
                    {isActive && !isCustomEntry && <Check className="h-3.5 w-3.5 text-white/50" />}
                    {isCustomEntry && <ChevronRight className="h-3.5 w-3.5 text-white/25" />}
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
                className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/60 mb-4 cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Volver
              </button>

              {/* Range display */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setSelecting("from")}
                  className={`flex-1 text-center py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                    selecting === "from"
                      ? "bg-violet-500/25 text-violet-300 border border-violet-500/30"
                      : "bg-white/[0.06] text-white/50 border border-white/[0.06] hover:bg-white/[0.08]"
                  }`}
                >
                  {tempFrom ? format(tempFrom, "d MMM yyyy", { locale: es }) : "Inicio"}
                </button>
                <span className="text-white/20 text-[12px]">→</span>
                <button
                  type="button"
                  onClick={() => setSelecting("to")}
                  className={`flex-1 text-center py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                    selecting === "to"
                      ? "bg-violet-500/25 text-violet-300 border border-violet-500/30"
                      : "bg-white/[0.06] text-white/50 border border-white/[0.06] hover:bg-white/[0.08]"
                  }`}
                >
                  {tempTo ? format(tempTo, "d MMM yyyy", { locale: es }) : "Fin"}
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
                  className="flex-1 py-2 rounded-lg text-[12px] font-medium text-white/40 hover:text-white/60 bg-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!tempFrom || !tempTo}
                  className="flex-1 py-2 rounded-lg text-[12px] font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
