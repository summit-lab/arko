"use client";

import { useTheme } from "@/components/layout/ThemeProvider";

export interface ChartTheme {
  isDark: boolean;
  axisTick: string;
  axisTickSubtle: string;
  axisTickMuted: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipTextMuted: string;
  tooltipMuted: string;
  tooltipShadow: string;
  cursorFill: string;
  cursor: string;
  cursorLine: string;
  trackFill: string;
  trackBorder: string;
  benchmarkLine: string;
  benchmarkDot: string;
  benchmarkDotStroke: string;
  benchmarkDotActive: string;
  subtleSurface: string;
  mutedSurface: string;
  panelBorder: string;
  overlayBg: string;
  /** Theme-aware accent green. Neon emerald in dark, darker emerald in light (neon is invisible on white). */
  greenAccent: string;
  greenAccentSoft: string;
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const axisTick        = isDark ? "rgba(255,255,255,0.4)"  : "rgba(17,17,17,0.65)";
  const axisTickSubtle  = isDark ? "rgba(255,255,255,0.25)" : "rgba(17,17,17,0.5)";
  const axisTickMuted   = isDark ? "rgba(255,255,255,0.2)"  : "rgba(17,17,17,0.45)";
  const grid            = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";
  const tooltipBg       = isDark ? "rgba(10,10,20,0.92)"    : "rgba(255,255,255,0.98)";
  const tooltipBorder   = isDark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.12)";
  const tooltipText     = isDark ? "rgba(255,255,255,0.95)" : "rgba(17,17,17,0.95)";
  const tooltipTextMuted = isDark ? "rgba(255,255,255,0.45)" : "rgba(17,17,17,0.6)";
  const cursorFill      = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";

  return {
    isDark,
    axisTick,
    axisTickSubtle,
    axisTickMuted,
    grid,
    tooltipBg,
    tooltipBorder,
    tooltipText,
    tooltipTextMuted,
    tooltipMuted: tooltipTextMuted,
    tooltipShadow: isDark ? "0 12px 48px rgba(0,0,0,0.6)" : "0 8px 28px rgba(0,0,0,0.14)",
    cursorFill,
    cursor: cursorFill,
    cursorLine: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.18)",
    trackFill:  isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
    trackBorder: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)",
    benchmarkLine: isDark ? "rgba(255,255,255,0.3)"  : "rgba(17,17,17,0.35)",
    benchmarkDot:  isDark ? "rgba(255,255,255,0.15)" : "rgba(17,17,17,0.15)",
    benchmarkDotStroke: isDark ? "rgba(255,255,255,0.4)" : "rgba(17,17,17,0.4)",
    benchmarkDotActive: isDark ? "rgba(255,255,255,0.5)" : "rgba(17,17,17,0.5)",
    subtleSurface: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)",
    mutedSurface:  isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    panelBorder:   isDark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.12)",
    overlayBg:     isDark ? "rgba(0,0,0,0.78)"       : "rgba(0,0,0,0.28)",
    greenAccent:   isDark ? "#34d399" : "#047857",
    greenAccentSoft: isDark ? "rgba(52,211,153,0.2)" : "rgba(4,120,87,0.2)",
  };
}
