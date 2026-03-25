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

const growthData = [
  { month: "Ene", organic: 120, ads: 40 },
  { month: "Feb", organic: 180, ads: 60 },
  { month: "Mar", organic: 150, ads: 90 },
  { month: "Abr", organic: 220, ads: 110 },
  { month: "May", organic: 280, ads: 130 },
  { month: "Jun", organic: 310, ads: 160 },
];

const engagementData = [
  { month: "Ene", likes: 8.2, saves: 3.1, comments: 1.4 },
  { month: "Feb", likes: 9.8, saves: 3.8, comments: 1.6 },
  { month: "Mar", likes: 7.5, saves: 2.9, comments: 1.2 },
  { month: "Abr", likes: 12.1, saves: 4.5, comments: 2.1 },
  { month: "May", likes: 14.3, saves: 5.2, comments: 2.4 },
  { month: "Jun", likes: 15.8, saves: 5.8, comments: 2.8 },
];

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
          <span className="text-[12px] text-white font-light ml-auto">{entry.value}K</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Growth Trend — Area Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-light text-white tracking-wide">Growth Trend</h3>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#818cf8]" />
              <span>Orgánico</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#c084fc]" />
              <span>Ads</span>
            </div>
          </div>
        </div>
        <div className="h-[200px] neon-line-violet">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOrganic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAds" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                tickFormatter={(v: number) => `${v}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="organic"
                name="Orgánico"
                stroke="#818cf8"
                strokeWidth={2}
                fill="url(#gradOrganic)"
                isAnimationActive={true}
                animationBegin={200}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="ads"
                name="Ads"
                stroke="#c084fc"
                strokeWidth={2}
                fill="url(#gradAds)"
                isAnimationActive={true}
                animationBegin={400}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={engagementData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                tickFormatter={(v: number) => `${v}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="likes" name="Likes" fill="#f472b6" radius={[6, 6, 0, 0]} barSize={14} fillOpacity={0.8} isAnimationActive={true} animationBegin={200} animationDuration={800} animationEasing="ease-out" />
              <Bar dataKey="saves" name="Saves" fill="#22d3ee" radius={[6, 6, 0, 0]} barSize={14} fillOpacity={0.8} isAnimationActive={true} animationBegin={400} animationDuration={800} animationEasing="ease-out" />
              <Bar dataKey="comments" name="Comments" fill="#34d399" radius={[6, 6, 0, 0]} barSize={14} fillOpacity={0.8} isAnimationActive={true} animationBegin={600} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
