import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  differenceInCalendarDays,
  startOfDay,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import type { DatePreset, DateRange } from "@/types/date-filter";

// ─── Core ────────────────────────────────────────────────────────────────────

/** YYYY-MM-DD from a Date */
export function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Resolve a preset to { from, to } (both YYYY-MM-DD, inclusive) */
export function resolvePreset(preset: string): DateRange {
  const today = startOfDay(new Date());
  const todayStr = toDateStr(today);
  const p = preset as DatePreset;

  switch (p) {
    case "ayer": {
      const y = toDateStr(subDays(today, 1));
      return { from: y, to: y, preset: p, days: 1 };
    }
    case "7d":
      return { from: toDateStr(subDays(today, 6)), to: todayStr, preset: p, days: 7 };
    case "14d":
      return { from: toDateStr(subDays(today, 13)), to: todayStr, preset: p, days: 14 };
    case "30d":
      return { from: toDateStr(subDays(today, 29)), to: todayStr, preset: p, days: 30 };
    case "90d":
      return { from: toDateStr(subDays(today, 89)), to: todayStr, preset: p, days: 90 };
    case "180d":
      return { from: toDateStr(subDays(today, 179)), to: todayStr, preset: p, days: 180 };
    case "365d":
      return { from: toDateStr(subDays(today, 364)), to: todayStr, preset: p, days: 365 };
    case "este_mes":
      return {
        from: toDateStr(startOfMonth(today)),
        to: todayStr,
        preset: p,
        days: differenceInCalendarDays(today, startOfMonth(today)) + 1,
      };
    case "mes_anterior": {
      const prev = subMonths(today, 1);
      const from = startOfMonth(prev);
      const to = endOfMonth(prev);
      return {
        from: toDateStr(from),
        to: toDateStr(to),
        preset: p,
        days: differenceInCalendarDays(to, from) + 1,
      };
    }
    case "custom":
      return { from: toDateStr(subDays(today, 29)), to: todayStr, preset: "custom", days: 30 };
    default:
      // Unknown preset (e.g. removed "hoy") → fallback to 30d
      return { from: toDateStr(subDays(today, 29)), to: todayStr, preset: "30d", days: 30 };
  }
}

/** Build a custom DateRange from two YYYY-MM-DD strings */
export function buildCustomRange(from: string, to: string): DateRange {
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  return { from, to, preset: "custom", days };
}

/** Compute the previous comparison period (same length, immediately before) */
export function previousPeriod(range: DateRange): { from: string; to: string } {
  const fromDate = parseISO(range.from);
  const prevTo = subDays(fromDate, 1);
  const prevFrom = subDays(prevTo, range.days - 1);
  return { from: toDateStr(prevFrom), to: toDateStr(prevTo) };
}

// ─── Conversion helpers for Supabase queries ─────────────────────────────────

/** Convert YYYY-MM-DD to ISO string (start of day UTC) — for timestamptz cols */
export function toISOStart(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

/** Convert YYYY-MM-DD to ISO string (end of day UTC) — for timestamptz cols */
export function toISOEnd(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

/** Next day YYYY-MM-DD (for exclusive upper bound .lt queries on date cols) */
export function nextDay(dateStr: string): string {
  return toDateStr(subDays(parseISO(dateStr), -1));
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** "8 abr 2026" */
export function fmtDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM yyyy", { locale: es });
}

/** "8 de abril de 2026" */
export function fmtDateLong(dateStr: string): string {
  return format(parseISO(dateStr), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** Label for the active range — e.g. "Últimos 30 días" or "1 mar – 15 mar" */
export function rangeLabel(range: DateRange): string {
  switch (range.preset) {
    case "ayer": return "Ayer";
    case "7d": return "Últimos 7 días";
    case "14d": return "Últimos 14 días";
    case "30d": return "Últimos 30 días";
    case "90d": return "Últimos 90 días";
    case "180d": return "Últimos 6 meses";
    case "365d": return "Último año";
    case "este_mes": return "Este mes";
    case "mes_anterior": return "Mes anterior";
    case "custom":
      return `${format(parseISO(range.from), "d MMM", { locale: es })} – ${format(parseISO(range.to), "d MMM", { locale: es })}`;
  }
}

// ─── URL helpers (backward compat with ?days=) ───────────────────────────────

/** Parse search params into a DateRange. Supports ?days= (legacy) and ?from=&to= (new) */
export function parseDateParams(
  searchParams: { days?: string; from?: string; to?: string; preset?: string },
  defaultPreset: DatePreset = "30d"
): DateRange {
  // If preset is explicitly set, use it directly (covers ayer, este_mes, etc.)
  if (searchParams.preset && searchParams.preset !== "custom") {
    return resolvePreset(searchParams.preset as DatePreset);
  }

  // Custom range: explicit from/to
  if (searchParams.from && searchParams.to) {
    return buildCustomRange(searchParams.from, searchParams.to);
  }

  // Legacy format: ?days=30 (without preset param)
  if (searchParams.days) {
    const days = parseInt(searchParams.days, 10);
    const presetMap: Record<number, DatePreset> = { 1: "ayer", 7: "7d", 14: "14d", 30: "30d", 90: "90d", 180: "180d", 365: "365d" };
    const preset = presetMap[days];
    if (preset) return resolvePreset(preset);
    // Arbitrary day count → custom range
    const today = startOfDay(new Date());
    return buildCustomRange(toDateStr(subDays(today, days - 1)), toDateStr(today));
  }

  return resolvePreset(defaultPreset);
}

/** Serialize a DateRange to URL search params string */
export function dateRangeToParams(range: DateRange): string {
  const params = new URLSearchParams();
  if (range.preset !== "custom") {
    params.set("days", String(range.days));
    params.set("preset", range.preset);
  } else {
    params.set("from", range.from);
    params.set("to", range.to);
    params.set("preset", "custom");
  }
  return params.toString();
}
