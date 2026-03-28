"use client";

import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";

interface DayData {
  day: string;
  views: number;
}

function RadarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] pointer-events-none"
      style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(20px)" }}>
      <p className="text-white">{payload[0].value.toLocaleString("es-AR")} views</p>
    </div>
  );
}

export function ReelDayRadar({ data }: { data: DayData[] }) {
  const bestDay = data.reduce((max, d) => (d.views > max.views ? d : max), data[0]);
  const hasData = data.some((d) => d.views > 0);

  if (!hasData) return null;

  return (
    <div>
      <p className="text-[10px] text-white/30 mb-0.5 uppercase tracking-[0.08em] font-medium">Views por día de semana</p>
      <p className="text-[10px] text-white/20 mb-3">Distribución de views de este reel</p>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis
              dataKey="day"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            />
            <Radar
              name="Views"
              dataKey="views"
              stroke="#818cf8"
              fill="#818cf8"
              fillOpacity={0.18}
              strokeWidth={2}
              animationDuration={1200}
            />
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div
        className="rounded-xl px-3 py-2.5 mt-2"
        style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.1)" }}
      >
        <p className="text-[9px] text-indigo-300/70 font-medium uppercase tracking-[0.08em] mb-0.5">Día con más views</p>
        <p className="text-[11px] text-white/50 font-light">
          <span className="text-white">{bestDay.day}</span>
          {" — "}<span className="text-indigo-300">{bestDay.views.toLocaleString("es-AR")}</span> views
        </p>
      </div>
    </div>
  );
}
