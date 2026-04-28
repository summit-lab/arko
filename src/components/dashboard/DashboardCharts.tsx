"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import { useChartTheme } from "@/hooks/useChartTheme";

interface GrowthDataPoint {
  date: string;
  reach: number;
  impressions: number;
}

interface EngagementDataPoint {
  date: string;
  likes: number;
  saves: number;
  comments: number;
}

interface SalesDataPoint {
  caption: string;
  amount: number;
  views: number;
}

interface DashboardChartsProps {
  growthData?: GrowthDataPoint[];
  engagementData?: EngagementDataPoint[];
  salesData?: SalesDataPoint[];
}

function formatCompactValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-xl px-4 py-3 bg-popover border border-border text-popover-foreground shadow-xl backdrop-blur-xl">
      <p className="text-[11px] text-muted-foreground font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-[11px] text-muted-foreground font-light">{entry.name}</span>
          <span className="text-[12px] text-popover-foreground font-light ml-auto">{formatCompactValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts({ growthData = [], engagementData = [], salesData = [] }: DashboardChartsProps) {
  const t = useTranslations("dashboardCharts");
  const hasGrowth = growthData.length > 0;
  const hasEngagement = engagementData.length > 0;
  const chart = useChartTheme();
  void salesData; // passed but used in parent sidebar

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Reach & Impressions — Area Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-light text-white tracking-wide">{t("reachTitle")}</h3>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#7A86E0]" />
              <span>{t("reachLegend")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#AF6EC7]" />
              <span>{t("impressionsLegend")}</span>
            </div>
          </div>
        </div>
        <div className="h-[200px] neon-line-violet">
          {hasGrowth ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7A86E0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#AF6EC7" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#AF6EC7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chart.grid}
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chart.axisTick, fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chart.axisTick, fontSize: 11 }}
                  tickFormatter={(v: number) => formatCompactValue(v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="reach"
                  name={t("reachLegend")}
                  stroke="#7A86E0"
                  strokeWidth={2}
                  fill="url(#gradReach)"
                  isAnimationActive={true}
                  animationBegin={200}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  name={t("impressionsLegend")}
                  stroke="#AF6EC7"
                  strokeWidth={2}
                  fill="url(#gradImpressions)"
                  isAnimationActive={true}
                  animationBegin={400}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[13px] text-white/20 font-light">{t("noReachData")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Engagement — Bar Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-light text-white tracking-wide">{t("engagementTitle")}</h3>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#7A86E0" }} />
              <span>{t("likesLegend")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#AF6EC7" }} />
              <span>{t("savesLegend")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#4BCEAF" }} />
              <span>{t("commentsLegend")}</span>
            </div>
          </div>
        </div>
        <div className="h-[200px]">
          {hasEngagement ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chart.grid}
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chart.axisTick, fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chart.axisTick, fontSize: 11 }}
                  tickFormatter={(v: number) => formatCompactValue(v)}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: chart.cursorFill }} />
                <Bar dataKey="likes" name={t("likesLegend")} fill="#7A86E0" radius={[4, 4, 0, 0]} barSize={8} fillOpacity={0.85} isAnimationActive={true} animationBegin={200} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="saves" name={t("savesLegend")} fill="#AF6EC7" radius={[4, 4, 0, 0]} barSize={8} fillOpacity={0.85} isAnimationActive={true} animationBegin={400} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="comments" name={t("commentsLegend")} fill="#4BCEAF" radius={[4, 4, 0, 0]} barSize={8} fillOpacity={0.85} isAnimationActive={true} animationBegin={600} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[13px] text-white/20 font-light">{t("noEngagementData")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
