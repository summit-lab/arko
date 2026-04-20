"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function useIsDark() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

interface DailyData {
  date: string;
  llm_cost: number;
  integration_cost: number;
  llm_calls: number;
  integration_calls: number;
}

interface FeatureData {
  feature: string;
  cost: number;
  calls: number;
}

interface UsageDailyChartProps {
  dailyData: DailyData[];
  featureData: FeatureData[];
}

/** Feature label map for readable names */
const FEATURE_LABELS: Record<string, string> = {
  'ai-agents': 'Moka AI Chat',
  'onboarding-adn': 'Onboarding ADN',
  'competitor-analysis': 'Análisis Competidores',
  'competitor-scraping': 'Scraping Competidores',
  'arkoai-video-analysis': 'Análisis Video (Reels)',
  'reel-diagnostics': 'Diagnóstico Reels',
  'metrics-analysis': 'Análisis Métricas',
  'reel-scrape': 'Sync Reels (Meta)',
};

/** Color map for features */
const FEATURE_COLORS: Record<string, string> = {
  'Moka AI Chat': '#818cf8',
  'Onboarding ADN': '#c084fc',
  'Análisis Competidores': '#f472b6',
  'Scraping Competidores': '#fb923c',
  'Análisis Video (Reels)': '#22d3ee',
  'Diagnóstico Reels': '#34d399',
  'Análisis Métricas': '#fbbf24',
  'Sync Reels (Meta)': '#a78bfa',
};

const DEFAULT_COLOR = '#64748b';

function getFeatureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

function getFeatureColor(label: string): string {
  return FEATURE_COLORS[label] ?? DEFAULT_COLOR;
}

function CostTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-xl px-4 py-3 backdrop-blur-xl bg-popover text-popover-foreground border border-border shadow-lg">
      <p className="text-[11px] text-muted-foreground font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-[11px] text-muted-foreground font-light">{entry.name}</span>
          <span className="text-[12px] text-foreground font-light ml-auto">${entry.value.toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
}

function FeatureTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { feature: string; cost: number; calls: number } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl px-4 py-3 backdrop-blur-xl bg-popover text-popover-foreground border border-border shadow-lg">
      <p className="text-[12px] text-foreground font-medium mb-1">{data.feature}</p>
      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">${data.cost.toFixed(4)}</p>
      <p className="text-[11px] text-muted-foreground">{data.calls} operaciones</p>
    </div>
  );
}

export function UsageDailyChart({ dailyData, featureData }: UsageDailyChartProps) {
  const isDark = useIsDark();
  const axisColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(17,17,17,0.6)";
  const axisColorStrong = isDark ? "rgba(255,255,255,0.5)" : "rgba(17,17,17,0.75)";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";

  // Transform feature data for display
  const chartFeatures = featureData
    .map((f) => ({
      ...f,
      feature: getFeatureLabel(f.feature),
      fill: getFeatureColor(getFeatureLabel(f.feature)),
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Daily cost trend — Area Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-light text-white tracking-wide">Costo Diario</h3>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#818cf8]" />
              <span>IA (LLM)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#fb923c]" />
              <span>Integraciones</span>
            </div>
          </div>
        </div>
        <div className="h-[220px] neon-line-violet">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradLlm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradInteg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb923c" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisColor, fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisColor, fontSize: 10 }}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip content={<CostTooltip />} />
              <Area
                type="monotone"
                dataKey="llm_cost"
                name="IA (LLM)"
                stroke="#818cf8"
                strokeWidth={2}
                fill="url(#gradLlm)"
                isAnimationActive
                animationBegin={200}
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="integration_cost"
                name="Integraciones"
                stroke="#fb923c"
                strokeWidth={2}
                fill="url(#gradInteg)"
                isAnimationActive
                animationBegin={400}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost by feature — Bar Chart */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[15px] font-light text-white tracking-wide">Costo por Sección</h3>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartFeatures}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} vertical />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisColor, fontSize: 10 }}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
              />
              <YAxis
                type="category"
                dataKey="feature"
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisColorStrong, fontSize: 10 }}
                width={130}
              />
              <Tooltip content={<FeatureTooltip />} />
              <Bar
                dataKey="cost"
                name="Costo"
                radius={[0, 6, 6, 0]}
                barSize={18}
                fillOpacity={0.85}
                isAnimationActive
                animationBegin={200}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {chartFeatures.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
