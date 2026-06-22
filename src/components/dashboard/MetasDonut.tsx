"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import { useChartTheme } from "@/hooks/useChartTheme";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCompact(n: number, unit?: string): string {
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ─── Single Donut ────────────────────────────────────────────────────────────

interface DonutProps {
  pct: number;
  color: string;
  label: string;
  current: string;
  goal: string;
}

function SingleDonut({ pct, color, label, current, goal }: DonutProps) {
  const chart = useChartTheme();
  const clamped = Math.min(Math.max(pct, 0), 100);
  const data = [
    { value: clamped },
    { value: 100 - clamped },
  ];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[80px] h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={36}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={color} opacity={0.85} />
              <Cell fill={chart.trackFill} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[13px] font-light text-white">{Math.round(clamped)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] text-white/50 font-light">{label}</p>
        <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
          <span className="text-[12px] text-white font-light">{current}</span>
          <span className="text-[9px] text-white/20">/{goal}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

// Metric → display config. Order here = order in UI.
const METRIC_CONFIG = [
  { key: "views", labelKey: "views", color: "#7A86E0", unit: undefined as string | undefined },
  { key: "followers", labelKey: "followers", color: "#4BCEAF", unit: undefined },
  { key: "engagement_rate", labelKey: "engagementRate", color: "#AF6EC7", unit: "%" },
  { key: "reach", labelKey: "reach", color: "#EB6991", unit: undefined },
  { key: "likes", labelKey: "likes", color: "#E0A86E", unit: undefined },
  { key: "saves", labelKey: "saves", color: "#6EC7C7", unit: undefined },
] as const;

type MetricKey = typeof METRIC_CONFIG[number]["key"];

interface MetasDonutProps {
  goals: Partial<Record<MetricKey, number | null>>;
  actuals: Partial<Record<MetricKey, number>>;
}

export function MetasDonut({ goals, actuals }: MetasDonutProps) {
  const t = useTranslations("igShell");
  const items: DonutProps[] = METRIC_CONFIG
    .filter((m) => {
      const g = goals[m.key];
      return g !== null && g !== undefined && g > 0;
    })
    .map((m) => {
      const goal = goals[m.key] as number;
      const actual = actuals[m.key] ?? 0;
      return {
        pct: (actual / goal) * 100,
        color: m.color,
        label: t(`metas.metricLabels.${m.labelKey}`),
        current: fmtCompact(actual, m.unit),
        goal: fmtCompact(goal, m.unit),
      };
    });

  return (
    <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-3">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">{t("metas.title")}</h3>
        <a href="/settings/metas" className="text-[10px] text-white/20 hover:text-white/50 transition-colors tracking-wider">
          {t("metas.configureArrow")}
        </a>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[12px] text-white/25 font-light">{t("metas.empty")}</p>
          <a
            href="/settings/metas"
            className="inline-block mt-2 text-[11px] font-medium transition-colors hover:text-white/60"
            style={{ color: "rgba(122,134,224,0.7)" }}
          >
            {t("metas.configureGoals")}
          </a>
        </div>
      ) : (
        // Grid 3 cols: hasta 3 metas en fila, el resto wrappea. gap-y mayor
        // que gap-x para que las filas respiren.
        <div className="grid grid-cols-3 gap-x-2 gap-y-5 justify-items-center">
          {items.map((item) => (
            <SingleDonut key={item.label} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
