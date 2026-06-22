"use client";

import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis } from "recharts";
import { useTranslations } from "next-intl";
import { useChartTheme } from "@/hooks/useChartTheme";

interface DailyPoint {
  date: string;
  views: number;
  cumulative: number;
}

interface Props {
  data: DailyPoint[];
}

function SparkTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DailyPoint }> }) {
  const t = useTranslations("igGrids");
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 bg-popover text-popover-foreground border border-border shadow-xl">
      <p className="text-[10px] text-muted-foreground font-medium">{d.date}</p>
      <p className="text-[13px] text-popover-foreground font-light">+{d.views.toLocaleString()} <span className="text-[10px] text-muted-foreground">{t("sparkline.views")}</span></p>
      <p className="text-[11px] font-light" style={{ color: "#7A86E0" }}>{d.cumulative.toLocaleString()} <span className="text-[10px] text-muted-foreground">{t("sparkline.cumulative")}</span></p>
    </div>
  );
}

export function ReelDailySparkline({ data }: Props) {
  const chart = useChartTheme();
  if (data.length < 2) return null;

  return (
    <div className="mt-2">
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7A86E0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: chart.axisTickSubtle, fontSize: 9 }}
              interval="preserveStartEnd"
            />
            <Tooltip content={<SparkTooltip />} cursor={{ stroke: chart.grid }} />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#7A86E0"
              strokeWidth={1.5}
              fill="url(#sparkGrad)"
              baseValue={0}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
