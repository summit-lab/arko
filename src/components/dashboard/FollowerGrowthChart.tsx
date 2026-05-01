"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Users } from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";

interface DataPoint {
  date: string;
  newFollowers: number;
}

interface Props {
  data: DataPoint[];
  totalGained: number;
  title: string;
  gainedLabel: string;
  newLabel: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function FollowerGrowthChart({ data, totalGained, title, gainedLabel, newLabel }: Props) {
  const chart = useChartTheme();

  const chartData = data.length === 1
    ? [data[0], { ...data[0], date: data[0].date + " " }]
    : data;

  return (
    <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-400/10 text-emerald-400">
            <Users className="h-[15px] w-[15px]" />
          </div>
          <div>
            <h3 className="text-[15px] font-light text-white tracking-wide">{title}</h3>
            {totalGained > 0 && (
              <p className="text-[12px] text-emerald-400 mt-0.5">
                +{fmt(totalGained)} <span className="text-white/30">{gainedLabel}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 180, width: "100%" }}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="followerGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.greenAccent} stopOpacity={0.35} />
                <stop offset="50%" stopColor={chart.greenAccent} stopOpacity={0.1} />
                <stop offset="100%" stopColor={chart.greenAccent} stopOpacity={0} />
              </linearGradient>
              <filter id="followerGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feFlood floodColor={chart.greenAccent} floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: chart.axisTickSubtle }}
              tickLine={false}
              axisLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chart.axisTickSubtle }}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={(v: number) => fmt(v)}
            />
            <Tooltip
              contentStyle={{
                background: chart.tooltipBg,
                border: `1px solid ${chart.tooltipBorder}`,
                borderRadius: 8,
                fontSize: 12,
                color: chart.tooltipText,
              }}
              labelStyle={{ color: chart.tooltipTextMuted, fontSize: 10 }}
              formatter={(value) => [`+${fmt(Number(value))} ${newLabel}`, ""]}
            />
            <Area
              type="monotone"
              dataKey="newFollowers"
              stroke={chart.greenAccent}
              fill="url(#followerGrowthGrad)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: chart.greenAccent, stroke: chart.greenAccent, strokeWidth: 2 }}
              style={{ filter: "url(#followerGlow)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
