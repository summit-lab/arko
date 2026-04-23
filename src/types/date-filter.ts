// ─── Date Filter — Shared Types ─────────────────────────────────────────────

export type DatePreset =
  | "ayer"
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "este_mes"
  | "mes_anterior"
  | "custom";

export interface DateRange {
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
  preset: DatePreset;
  /** Computed days in range — useful for backward compat with ?days= */
  days: number;
}

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "7 días" },
  { key: "14d", label: "14 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "este_mes", label: "Este mes" },
  { key: "mes_anterior", label: "Mes anterior" },
  { key: "custom", label: "Personalizado" },
];
