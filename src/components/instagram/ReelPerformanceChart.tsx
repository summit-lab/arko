"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

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
  if (!active || !payload?.length) return null;
  const actual = payload.find((p) => p.dataKey === "actual");
  const benchmark = payload.find((p) => p.dataKey === "benchmark");
  return (
    <div
      className="rounded-xl border border-white/[0.08] px-4 py-3"
      style={{
        background: "rgba(10,10,20,0.55)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}
    >
      <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.1em] mb-2">{label}</p>
      {actual && (
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-[18px] font-light" style={{ color: "#7A86E0" }}>{actual.value.toFixed(2)}%</span>
          <span className="text-[10px] text-white/30">este reel</span>
        </div>
      )}
      {benchmark && benchmark.value > 0 && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-light text-white/40">{benchmark.value.toFixed(2)}%</span>
          <span className="text-[10px] text-white/25">benchmark</span>
        </div>
      )}
    </div>
  );
}

export function ReelPerformanceChart({
  likes, saves, comments, shares, viewsTotal,
  benchmarkLikes, benchmarkSaves, benchmarkComments, benchmarkShares,
}: ReelPerformanceChartProps) {
  const data = [
    {
      name: "Likes",
      actual: pct(likes, viewsTotal),
      benchmark: benchmarkLikes ?? 0,
    },
    {
      name: "Saves",
      actual: pct(saves, viewsTotal),
      benchmark: benchmarkSaves ?? 0,
    },
    {
      name: "Comments",
      actual: pct(comments, viewsTotal),
      benchmark: benchmarkComments ?? 0,
    },
    {
      name: "Shares",
      actual: pct(shares, viewsTotal),
      benchmark: benchmarkShares ?? 0,
    },
  ];

  const hasBenchmark = [benchmarkLikes, benchmarkSaves, benchmarkComments, benchmarkShares].some((v) => v != null && v > 0);

  return (
    <div
      className="flex h-full flex-col rounded-xl p-5 backdrop-blur-xl"
      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.08em]">Interacciones vs Benchmark</p>
          <p className="text-[10px] text-white/20 mt-0.5">% sobre views totales vs promedio 90d</p>
        </div>
        {hasBenchmark && (
          <div className="flex items-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-sm" style={{ background: "#7A86E0" }} />
              <span className="text-white/35">Reel</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-[1.5px] w-3 rounded" style={{ background: "rgba(255,255,255,0.25)" }} />
              <span className="text-white/35">Bench</span>
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)", fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar
              dataKey="actual"
              name="Este reel"
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
                name="Benchmark"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 4, fill: "rgba(255,255,255,0.15)", stroke: "rgba(255,255,255,0.4)", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: "rgba(255,255,255,0.5)", stroke: "rgba(255,255,255,0.6)", strokeWidth: 1.5 }}
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
