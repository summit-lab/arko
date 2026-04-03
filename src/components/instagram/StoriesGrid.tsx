"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Eye, MessageCircle, ChevronLeft, ChevronRight, Users,
  TrendingDown, Image as ImageIcon, Clock,
} from "lucide-react";

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
  return n.toString();
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}sem`;
  return `${Math.floor(days / 30)}mes`;
}

// Drop-off rate between slide 0 and current slide
function dropOff(first: number, current: number): string {
  if (first === 0 || current >= first) return "—";
  const pct = ((first - current) / first) * 100;
  return `${pct.toFixed(0)}%`;
}

// ─── Slide carousel ──────────────────────────────────────────────────────────

function SlideCarousel({ slides }: { slides: StorySlide[] }) {
  const [idx, setIdx] = useState(0);
  const slide = slides[idx];
  const firstImpressions = slides[0]?.impressions ?? 0;

  if (!slide) return null;

  return (
    <div className="space-y-3">
      {/* Slide image */}
      <div className="relative rounded-lg overflow-hidden bg-white/[0.03]"
        style={{ aspectRatio: "9/16", maxHeight: "280px" }}>
        {slide.thumbnail_url || slide.media_url ? (
          <Image
            src={slide.thumbnail_url ?? slide.media_url ?? ""}
            alt={`Slide ${idx + 1}`}
            fill
            className="object-cover"
            sizes="180px"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="h-6 w-6 text-white/15" />
          </div>
        )}

        {/* Slide counter */}
        {slides.length > 1 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            {idx + 1}/{slides.length}
          </div>
        )}

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            {idx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setIdx(i => i - 1); }}
                className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-white/20"
                style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
              >
                <ChevronLeft className="h-3.5 w-3.5 text-white" />
              </button>
            )}
            {idx < slides.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setIdx(i => i + 1); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-white/20"
                style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
              >
                <ChevronRight className="h-3.5 w-3.5 text-white" />
              </button>
            )}
          </>
        )}

        {/* Slide dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`rounded-full transition-all cursor-pointer ${i === idx ? "w-3 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Slide KPIs */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg px-2.5 py-2 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.06em] mb-0.5">Espect.</p>
          <p className="text-[14px] font-light text-white">{fmt(slide.impressions)}</p>
        </div>
        <div className="rounded-lg px-2.5 py-2 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.06em] mb-0.5">Respuestas</p>
          <p className="text-[14px] font-light text-white">{fmt(slide.replies)}</p>
        </div>
        {idx > 0 && (
          <div className="rounded-lg px-2.5 py-2 text-center col-span-2" style={{ background: "rgba(239,68,68,0.05)" }}>
            <p className="text-[9px] text-rose-400/60 uppercase tracking-[0.06em] mb-0.5">Drop-off vs slide 1</p>
            <p className="text-[14px] font-light text-rose-300">{dropOff(firstImpressions, slide.impressions)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary sidebar ──────────────────────────────────────────────────────────

function StoriesSummary({ sequences }: { sequences: StorySequence[] }) {
  const totalSequences = sequences.length;
  const totalSlides = sequences.reduce((s, seq) => s + seq.slides.length, 0);
  const totalImpressions = sequences.reduce((s, seq) => s + seq.total_impressions, 0);
  const totalReplies = sequences.reduce((s, seq) => s + seq.total_replies, 0);
  const avgImpressions = totalSequences > 0 ? Math.round(totalImpressions / totalSequences) : 0;

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="glass-card p-5 space-y-4">
        <p className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em]">Resumen</p>
        {[
          { label: "Secuencias", value: fmt(totalSequences), icon: Clock },
          { label: "Slides totales", value: fmt(totalSlides), icon: ImageIcon },
          { label: "Impresiones", value: fmt(totalImpressions), icon: Eye },
          { label: "Respuestas", value: fmt(totalReplies), icon: MessageCircle },
          { label: "Prom. por historia", value: fmt(avgImpressions), icon: Users },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <s.icon className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[12px] font-light text-white/50">{s.label}</span>
            </div>
            <span className="text-[15px] font-light text-white">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Drop-off info */}
      <div className="glass-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="h-3.5 w-3.5 text-rose-400/60" />
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em]">Drop-off por historia</p>
        </div>
        {sequences.slice(0, 5).map((seq) => {
          const first = seq.slides[0]?.impressions ?? 0;
          const last = seq.slides[seq.slides.length - 1]?.impressions ?? first;
          const drop = first > 0 ? ((first - last) / first) * 100 : 0;
          return (
            <div key={seq.id} className="flex items-center gap-2">
              <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded-full bg-rose-400/40" style={{ width: `${Math.min(drop, 100)}%` }} />
              </div>
              <span className="text-[10px] text-white/30 w-8 text-right">{drop.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StoriesGrid({ sequences }: StoriesGridProps) {
  if (sequences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
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
    <div className="flex gap-6">
      {/* ── Gallery (main) ── */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="group rounded-xl overflow-hidden transition-transform duration-200 hover:scale-[1.02]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="p-3">
                <SlideCarousel slides={seq.slides} />
                {/* Sequence meta */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/30 font-light">{timeAgo(seq.published_at)}</span>
                    {seq.archived && (
                      <span className="text-[8px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded-full">Archivada</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5 text-[9px] text-white/40">
                      <Eye className="h-2.5 w-2.5" /> {fmt(seq.total_impressions)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-white/40">
                      <MessageCircle className="h-2.5 w-2.5" /> {fmt(seq.total_replies)}
                    </span>
                    {seq.slides.length > 1 && (
                      <span className="text-[8px] text-white/25 ml-auto">{seq.slides.length} slides</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary sidebar ── */}
      <div className="w-[240px] shrink-0">
        <StoriesSummary sequences={sequences} />
      </div>
    </div>
  );
}
