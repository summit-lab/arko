"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import { useChartTheme } from "@/hooks/useChartTheme";

interface ReelPerformanceChartProps {
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  viewsTotal: number;
  benchmarkLikes: number | null;
  benchmarkSaves: number | null;
  benchmarkComments: number | null;
  benchmarkShares: number | null;
}

function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(3));
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  const t = useTranslations("igGrids");
  if (!active || !payload?.length) return null;
  const actual = payload.find((p) => p.dataKey === "actual");
  const benchmark = payload.find((p) => p.dataKey === "benchmark");
  return (
    <div className="rounded-xl border border-border bg-popover text-popover-foreground px-4 py-3 backdrop-blur-xl shadow-xl">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.1em] mb-2">{label}</p>
      {actual && (
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-[18px] font-light" style={{ color: "#7A86E0" }}>{actual.value.toFixed(2)}%</span>
          <span className="text-[10px] text-muted-foreground">{t("perfChart.thisReel")}</span>
        </div>
      )}
      {benchmark && benchmark.value > 0 && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-light text-muted-foreground">{benchmark.value.toFixed(2)}%</span>
          <span className="text-[10px] text-muted-foreground">{t("perfChart.benchmark")}</span>
        </div>
      )}
    </div>
  );
}

export function ReelPerformanceChart({
  likes, saves, comments, shares, viewsTotal,
  benchmarkLikes, benchmarkSaves, benchmarkComments, benchmarkShares,
}: ReelPerformanceChartProps) {
  const chart = useChartTheme();
  const t = useTranslations("igGrids");
  const data = [
    {
      name: t("perfChart.likes"),
      actual: pct(likes, viewsTotal),
      benchmark: benchmarkLikes ?? 0,
    },
    {
      name: t("perfChart.saves"),
      actual: pct(saves, viewsTotal),
      benchmark: benchmarkSaves ?? 0,
    },
    {
      name: t("perfChart.comments"),
      actual: pct(comments, viewsTotal),
      benchmark: benchmarkComments ?? 0,
    },
    {
      name: t("perfChart.shares"),
      actual: pct(shares, viewsTotal),
      benchmark: benchmarkShares ?? 0,
    },
  ];

  const hasBenchmark = [benchmarkLikes, benchmarkSaves, benchmarkComments, benchmarkShares].some((v) => v != null && v > 0);

  return (
    <div className="glass-panel flex h-full flex-col rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.08em]">{t("perfChart.title")}</p>
          <p className="text-[10px] text-white/20 mt-0.5">{t("perfChart.subtitle")}</p>
        </div>
        {hasBenchmark && (
          <div className="flex items-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-sm" style={{ background: "#7A86E0" }} />
              <span className="text-white/35">{t("perfChart.reelLegend")}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-[1.5px] w-3 rounded" style={{ background: chart.benchmarkLine }} />
              <span className="text-white/35">{t("perfChart.benchLegend")}</span>
            </div>
          </div>
        )}
      </div>
      <div className="min-h-[260px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="perfBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#7A86E0" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: chart.axisTick, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chart.axisTickSubtle }}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: chart.cursorFill }} />
            <Bar
              dataKey="actual"
              name={t("perfChart.thisReel")}
              fill="url(#perfBarGrad)"
              radius={[6, 6, 0, 0]}
              maxBarSize={56}
              animationDuration={800}
              animationEasing="ease-out"
            />
            {hasBenchmark && (
              <Line
                type="monotone"
                dataKey="benchmark"
                name={t("perfChart.benchmark")}
                stroke={chart.benchmarkLine}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 4, fill: chart.benchmarkDot, stroke: chart.benchmarkDotStroke, strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: chart.benchmarkDotActive, stroke: chart.benchmarkDotStroke, strokeWidth: 1.5 }}
                animationDuration={1000}
                animationEasing="ease-out"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
