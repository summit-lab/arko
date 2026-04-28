"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Heart, Bookmark, MessageCircle, Share2, Eye,
  Images, ChevronLeft, ChevronRight, ExternalLink,
  Grid2X2,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

// ─── Types ───

interface CarouselSlide {
  id: string;
  ig_media_id: string;
  slide_index: number;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
}

interface PostDetailData {
  id: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  published_at: string | null;
  media_type: string | null;
  likes: number;
  saves: number | null;
  comments: number;
  shares: number;
  views_total: number;
  reach: number;
  impressions: number;
  carousel_slides: CarouselSlide[];
}

// ─── Helpers ───

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pctOf(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(2)}%`;
}

// ─── Carousel Gallery ───

function CarouselGallery({ slides, fallbackUrl }: { slides: CarouselSlide[]; fallbackUrl: string | null }) {
  const t = useTranslations("igGrids");
  const [current, setCurrent] = useState(0);

  // If no slides, show single image
  const images = slides.length > 0
    ? slides.map((s) => s.thumbnail_url || s.media_url || null)
    : [fallbackUrl];

  const totalSlides = images.length;
  const canPrev = current > 0;
  const canNext = current < totalSlides - 1;

  return (
    <div className="relative w-full">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-xl">
        {images[current] ? (
          <Image
            src={images[current]!}
            alt={`${t("postDetail.slide")} ${current + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
            priority={current === 0}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Grid2X2 className="h-8 w-8 text-white/15" />
          </div>
        )}

        {/* Slide counter */}
        {totalSlides > 1 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-medium text-white bg-black/60 backdrop-blur-sm">
            {current + 1} / {totalSlides}
          </div>
        )}

        {/* Navigation arrows */}
        {totalSlides > 1 && (
          <>
            {canPrev && (
              <button
                onClick={() => setCurrent(current - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer transition-all bg-black/50 backdrop-blur-sm hover:bg-black/70"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
            )}
            {canNext && (
              <button
                onClick={() => setCurrent(current + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer transition-all bg-black/50 backdrop-blur-sm hover:bg-black/70"
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {totalSlides > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden cursor-pointer transition-all border border-white/[0.08] ${
                i === current ? "ring-2 ring-indigo-400 opacity-100" : "opacity-40 hover:opacity-70"
              }`}
            >
              {url ? (
                <Image src={url} alt={`${t("postDetail.thumb")} ${i + 1}`} fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex items-center justify-center h-full bg-white/[0.03]">
                  <Grid2X2 className="h-3 w-3 text-white/20" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export function PostDetailView({ post }: { post: PostDetailData }) {
  const t = useTranslations("igGrids");
  const locale = useLocale();
  const isCarousel = post.media_type === "CAROUSEL_ALBUM";
  const totalInteractions = post.likes + (post.saves ?? 0) + post.comments + post.shares;
  // Posts don't have "views" — use impressions or reach as denominator
  const engDenominator = post.impressions > 0 ? post.impressions : post.reach > 0 ? post.reach : post.views_total;
  const engRate = engDenominator > 0
    ? ((totalInteractions / engDenominator) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(280px,400px)_minmax(0,1fr)]">
      {/* Left — Gallery */}
      <div className="md:sticky md:top-6 self-start space-y-4">
        <CarouselGallery
          slides={post.carousel_slides}
          fallbackUrl={post.thumbnail_url || post.media_url}
        />

        {post.permalink && (
          <div className="flex justify-center">
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-medium text-white/60 transition-all cursor-pointer hover:text-white hover:bg-white/[0.06] border border-white/[0.08]"
            >
              <ExternalLink className="h-3 w-3" />
              {t("postDetail.openInInstagram")}
            </a>
          </div>
        )}
      </div>

      {/* Right — Content + Metrics */}
      <div className="flex flex-col gap-5">
        {/* Caption + Meta */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
              style={{
                background: isCarousel ? "rgba(139,92,246,0.12)" : "rgba(34,211,238,0.12)",
                color: isCarousel ? "#c4b5fd" : "#67e8f9",
                border: isCarousel ? "1px solid rgba(139,92,246,0.2)" : "1px solid rgba(34,211,238,0.2)",
              }}
            >
              {isCarousel ? <Images className="h-2.5 w-2.5" /> : <Grid2X2 className="h-2.5 w-2.5" />}
              {isCarousel ? t("postDetail.carouselWithSlides", { count: post.carousel_slides.length }) : t("postDetail.postBadge")}
            </span>
          </div>

          <p className="text-base leading-relaxed text-white/90 whitespace-pre-wrap">
            {post.caption || t("postDetail.noDescription")}
          </p>

          <p className="mt-3 text-xs text-white/40">
            {post.published_at
              ? new Date(post.published_at).toLocaleDateString(locale === "en" ? "en-US" : "es-AR", { day: "numeric", month: "long", year: "numeric" })
              : "—"}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: t("common.likes"), value: post.likes, icon: Heart, color: "text-rose-400" },
            { label: t("common.saves"), value: post.saves ?? 0, icon: Bookmark, color: "text-amber-400", unavailable: post.saves === null },
            { label: t("common.comments"), value: post.comments, icon: MessageCircle, color: "text-emerald-400" },
            { label: t("common.shares"), value: post.shares, icon: Share2, color: "text-blue-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-panel rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color} opacity-60`} strokeWidth={1.8} />
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className="text-[28px] font-light text-white leading-none tracking-tight">{"unavailable" in kpi && kpi.unavailable ? "—" : fmt(kpi.value)}</p>
              {engDenominator > 0 && !("unavailable" in kpi && kpi.unavailable) && (
                <p className="mt-1.5 text-[11px] text-white/30">{t("postDetail.pctOf", { pct: pctOf(kpi.value, engDenominator), basis: post.impressions > 0 ? t("postDetail.impressions") : t("postDetail.reach") })}</p>
              )}
            </div>
          ))}
        </div>

        {/* Engagement Overview */}
        <div className="glass-section rounded-xl p-5">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] mb-4">{t("postDetail.summary")}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t("postDetail.views"), value: fmt(post.views_total), icon: Eye },
              { label: t("postDetail.reach"), value: fmt(post.reach), icon: Eye },
              { label: t("postDetail.impressions"), value: fmt(post.impressions), icon: Eye },
              { label: t("postDetail.engRate"), value: `${engRate}%`, icon: Heart },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-[22px] font-light text-white leading-none">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Interaction breakdown bar */}
          {totalInteractions > 0 && (
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">{t("postDetail.interactionsDistribution")}</p>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                {[
                  { value: post.likes, color: "bg-rose-400/80" },
                  { value: post.saves ?? 0, color: "bg-amber-400/80" },
                  { value: post.comments, color: "bg-emerald-400/80" },
                  { value: post.shares, color: "bg-blue-400/80" },
                ].map((seg, i) => (
                  <div
                    key={i}
                    className={seg.color}
                    style={{ width: `${(seg.value / totalInteractions) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-white/40">
                <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400/80 mr-1" />{t("common.likes")} {pctOf(post.likes, totalInteractions)}</span>
                <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/80 mr-1" />{t("common.saves")} {pctOf(post.saves ?? 0, totalInteractions)}</span>
                <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80 mr-1" />{t("common.comments")} {pctOf(post.comments, totalInteractions)}</span>
                <span><span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400/80 mr-1" />{t("common.shares")} {pctOf(post.shares, totalInteractions)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
