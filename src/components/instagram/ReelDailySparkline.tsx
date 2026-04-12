"use client";

import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis } from "recharts";

interface DailyPoint {
  date: string;
  views: number;
  cumulative: number;
}

interface Props {
  data: DailyPoint[];
}

function SparkTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DailyPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background: "rgba(12,12,20,0.94)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <p className="text-[10px] text-white/40 font-medium">{d.date}</p>
      <p className="text-[13px] text-white font-light">+{d.views.toLocaleString()} <span className="text-[10px] text-white/40">views</span></p>
      <p className="text-[11px] font-light" style={{ color: "#7A86E0" }}>{d.cumulative.toLocaleString()} <span className="text-[10px] text-white/30">acumuladas</span></p>
    </div>
  );
}

export function ReelDailySparkline({ data }: Props) {
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
              tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }}
              interval="preserveStartEnd"
            />
            <Tooltip content={<SparkTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
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
