"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Eye, MessageCircle, ArrowRight, ArrowLeft as ArrowLeftIcon,
  Image as ImageIcon, TrendingDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StorySlide {
  id: string;
  ig_media_id: string;
  slide_index: number;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  impressions: number;
  reach: number;
  replies: number;
  exits: number;
  taps_forward: number;
  taps_back: number;
  swipe_aways: number;
  archived: boolean;
}

interface StorySequence {
  id: string;
  ig_story_id: string;
  published_at: string;
  expires_at: string | null;
  total_impressions: number;
  total_reach: number;
  total_replies: number;
  total_exits: number;
  archived: boolean;
  slides: StorySlide[];
}

interface StoriesGridProps {
  sequences: StorySequence[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("es-AR", { month: "short", day: "numeric", year: "numeric" });
}

function dropPct(first: number, current: number): number {
  if (first === 0) return 0;
  return ((first - current) / first) * 100;
}

// glass inline styles (avoid reliance on global CSS classes)
const glassCard = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
  backdropFilter: "blur(20px)",
} as const;

const glassSection = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
  backdropFilter: "blur(20px)",
} as const;

// ─── Chart tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={{ ...glassCard, boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}>
      <p className="text-[10px] uppercase tracking-[0.06em] mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
      <p className="text-[15px] font-light text-white">{fmt(payload[0].value)} views</p>
    </div>
  );
}

// ─── Single Sequence Block ───────────────────────────────────────────────────

function SequenceBlock({ seq }: { seq: StorySequence }) {
  const slides = seq.slides;
  const firstViews = slides[0]?.impressions ?? 0;
  const lastViews = slides[slides.length - 1]?.impressions ?? firstViews;
  const completionRate = firstViews > 0 ? (lastViews / firstViews) * 100 : 0;
  const isActive = !seq.archived && seq.expires_at && new Date(seq.expires_at) > new Date();

  // Scroll ref for horizontal flow
  const [scrollRef, setScrollRef] = useState<HTMLDivElement | null>(null);
  const scrollBy = (dir: number) => scrollRef?.scrollBy({ left: dir * 300, behavior: "smooth" });

  // Drop-off curve data
  const curveData = slides.map((s, i) => ({
    name: `${i + 1}`,
    views: s.impressions,
  }));

  return (
    <div className="space-y-4">
      {/* ── Sequence header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[15px] font-light text-white">
            {fmtDate(seq.published_at)}
          </p>
          <span className="text-[11px] text-white/30">·</span>
          <span className="text-[11px] text-white/30 font-light">{slides.length} slides</span>
          <span className="text-[11px] text-white/30">·</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/25"}`}>
            {isActive ? "Active" : "Archived"}
          </span>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Views", value: fmt(firstViews) },
          { label: "Completions", value: fmt(lastViews) },
          { label: "Completion Rate", value: `${completionRate.toFixed(1)}%` },
          { label: "Slides", value: slides.length.toString() },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl p-4" style={glassCard}>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>{kpi.label}</p>
            <p className="text-[32px] font-light tracking-[-0.02em] text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Sequence Flow ── */}
      <div className="rounded-xl p-5" style={glassSection}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Sequence Flow
          </p>
          {slides.length > 4 && (
            <div className="flex items-center gap-1">
              <button onClick={() => scrollBy(-1)} className="h-6 w-6 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/[0.06]" style={{ background: "rgba(255,255,255,0.04)" }}>
                <ChevronLeft className="h-3.5 w-3.5 text-white/50" />
              </button>
              <button onClick={() => scrollBy(1)} className="h-6 w-6 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/[0.06]" style={{ background: "rgba(255,255,255,0.04)" }}>
                <ChevronRight className="h-3.5 w-3.5 text-white/50" />
              </button>
            </div>
          )}
        </div>

        {/* Horizontal scroll */}
        <div ref={setScrollRef} className="overflow-x-auto pb-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
          <div className="flex items-start min-w-max">
            {slides.map((slide, i) => {
              const drop = i > 0 ? dropPct(slides[i - 1].impressions, slide.impressions) : 0;

              return (
                <div key={slide.id} className="flex items-start">
                  {/* ── Drop-off connector ── */}
                  {i > 0 && (
                    <div className="flex flex-col items-center justify-center shrink-0" style={{ width: "48px", marginTop: "90px" }}>
                      <div className="w-full relative flex items-center">
                        <div className="w-full h-[1px]" style={{ background: "rgba(255,255,255,0.08)" }} />
                        <ArrowRight className="absolute right-0 h-3 w-3 text-white/15 -mr-1" />
                      </div>
                      <div className="mt-1.5 px-1.5 py-0.5 rounded-md" style={{ background: "rgba(244,114,182,0.12)" }}>
                        <span className="text-[11px] font-medium" style={{ color: "#f472b6" }}>
                          -{drop.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ── Slide card ── */}
                  <div className="flex flex-col items-center shrink-0" style={{ width: "160px" }}>
                    {/* Image */}
                    <div
                      className="relative w-full rounded-xl overflow-hidden"
                      style={{
                        height: "220px",
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "rgba(255,255,255,0.03)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                      }}
                    >
                      {slide.thumbnail_url || slide.media_url ? (
                        <Image
                          src={slide.thumbnail_url ?? slide.media_url ?? ""}
                          alt={`Slide ${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="h-5 w-5 text-white/15" />
                        </div>
                      )}

                      {/* Slide number */}
                      <div className="absolute top-2 left-2 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white/80" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
                        {i + 1}
                      </div>
                    </div>

                    {/* Metrics below */}
                    <div className="mt-3 text-center w-full space-y-1">
                      <div className="flex items-center justify-center gap-1.5">
                        <Eye className="h-3 w-3 text-white/35" />
                        <span className="text-[14px] font-light text-white">{fmt(slide.impressions)}</span>
                      </div>

                      {i > 0 && (
                        <p className="text-[11px] font-medium" style={{ color: "#f472b6" }}>
                          Drop-off <span className="ml-1">-{drop.toFixed(2)}%</span>
                        </p>
                      )}

                      {/* Navigation metrics */}
                      <div className="flex items-center justify-center gap-2 text-[10px] text-white/25">
                        {slide.exits > 0 && (
                          <span className="flex items-center gap-0.5">
                            <ArrowRight className="h-2.5 w-2.5" /> {fmt(slide.exits)}
                          </span>
                        )}
                        {slide.replies > 0 && (
                          <span className="flex items-center gap-0.5">
                            <MessageCircle className="h-2.5 w-2.5" /> {fmt(slide.replies)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Drop-off Curve ── */}
      {slides.length > 1 && (
        <div className="rounded-xl p-5" style={glassSection}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-3.5 w-3.5 text-rose-400/60" />
            <p className="text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Viewer Drop-off Curve
            </p>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#818cf8" }} />
              <span className="text-[10px] text-white/30">Views</span>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${seq.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  label={{ value: "Slide", position: "insideBottomRight", offset: -5, fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  tickFormatter={(v: number) => fmt(v)}
                  width={50}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill={`url(#grad-${seq.id})`}
                  dot={{ fill: "#818cf8", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#818cf8", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StoriesGrid({ sequences }: StoriesGridProps) {
  if (sequences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.04)" }}>
          <ImageIcon className="h-6 w-6 text-white/20" />
        </div>
        <h3 className="text-[15px] font-light text-white/50">Sin historias guardadas</h3>
        <p className="mt-2 text-[12px] text-white/25 max-w-md font-light">
          Las historias se archivan automáticamente dentro de las 24hs de publicarse.
          Sincronizá tu cuenta para capturar las historias activas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {sequences.map((seq) => (
        <SequenceBlock key={seq.id} seq={seq} />
      ))}
    </div>
  );
}
