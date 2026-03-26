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

interface DashboardChartsProps {
  growthData?: GrowthDataPoint[];
  engagementData?: EngagementDataPoint[];
}

function formatCompactValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 backdrop-blur-xl"
      style={{
        background: "rgba(0,0,0,0.85)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}
    >
      <p className="text-[11px] text-white/40 font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-[11px] text-white/60 font-light">{entry.name}</span>
          <span className="text-[12px] text-white font-light ml-auto">{formatCompactValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts({ growthData = [], engagementData = [] }: DashboardChartsProps) {
  const hasGrowth = growthData.length > 0;
  const hasEngagement = engagementData.length > 0;

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Reach & Impressions — Area Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-light text-white tracking-wide">Reach & Impressions</h3>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#818cf8]" />
              <span>Reach</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#c084fc]" />
              <span>Impressions</span>
            </div>
          </div>
        </div>
        <div className="h-[200px] neon-line-violet">
          {hasGrowth ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  tickFormatter={(v: number) => formatCompactValue(v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="reach"
                  name="Reach"
                  stroke="#818cf8"
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
                  name="Impressions"
                  stroke="#c084fc"
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
              <p className="text-[13px] text-white/20 font-light">Sin datos de alcance</p>
            </div>
          )}
        </div>
      </div>

      {/* Engagement — Bar Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-light text-white tracking-wide">Engagement</h3>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#f472b6]" />
              <span>Likes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
              <span>Saves</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
              <span>Comments</span>
            </div>
          </div>
        </div>
        <div className="h-[200px]">
          {hasEngagement ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  tickFormatter={(v: number) => formatCompactValue(v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="likes" name="Likes" fill="#f472b6" radius={[4, 4, 0, 0]} barSize={8} fillOpacity={0.8} isAnimationActive={true} animationBegin={200} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="saves" name="Saves" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={8} fillOpacity={0.8} isAnimationActive={true} animationBegin={400} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="comments" name="Comments" fill="#34d399" radius={[4, 4, 0, 0]} barSize={8} fillOpacity={0.8} isAnimationActive={true} animationBegin={600} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[13px] text-white/20 font-light">Sin datos de engagement</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
