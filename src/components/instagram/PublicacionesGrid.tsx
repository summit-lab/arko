"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Heart, Bookmark, MessageCircle, Share2, Eye,
  Images, Grid2X2, ExternalLink,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  ig_media_id: string;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  media_type: string | null;       // IMAGE | CAROUSEL_ALBUM | VIDEO
  views_total: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
}

interface PostsSummary {
  totalPosts: number;
  totalCarruseles: number;
  totalLikes: number;
  totalSaves: number;
  totalComments: number;
  avgLikes: number;
}

interface PublicacionesGridProps {
  posts: Post[];
  summary?: PostsSummary;
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

const PIE_COLORS = ["#818cf8", "#22d3ee"];

// ─── Post card ───────────────────────────────────────────────────────────────

function PostCard({ post }: { post: Post }) {
  const isCarrusel = post.media_type === "CAROUSEL_ALBUM";
  const engRate = (post.likes + post.comments + post.saves + post.shares) > 0 && post.views_total > 0
    ? (((post.likes + post.comments + post.saves + post.shares) / post.views_total) * 100).toFixed(1)
    : null;

  return (
    <Link
      href={`/instagram/${post.id}`}
      className="group block rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.015]"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "1/1" }}>
        {post.thumbnail_url ? (
          <Image
            src={post.thumbnail_url}
            alt={post.caption?.slice(0, 30) || "Post"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            sizes="200px"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-white/[0.03]">
            <Grid2X2 className="h-8 w-8 text-white/15" />
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          {isCarrusel ? <Images className="h-2.5 w-2.5 text-violet-300" /> : <Grid2X2 className="h-2.5 w-2.5 text-cyan-300" />}
          <span className="text-white/70">{isCarrusel ? "Carrusel" : "Post"}</span>
        </div>
        {/* Time */}
        {post.published_at && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] text-white/50"
            style={{ background: "rgba(0,0,0,0.5)" }}>
            {timeAgo(post.published_at)}
          </div>
        )}
        {/* Eng rate overlay */}
        {engRate && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium text-emerald-300"
            style={{ background: "rgba(52,211,153,0.15)", backdropFilter: "blur(4px)" }}>
            {engRate}%
          </div>
        )}
      </div>

      {/* Caption + stats */}
      <div className="p-3 space-y-2">
        <p className="text-[11px] font-light text-white/60 group-hover:text-white/80 transition-colors line-clamp-2 leading-relaxed">
          {post.caption?.slice(0, 80) || "Sin descripción"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-0.5 text-[10px] text-white/40">
            <Heart className="h-2.5 w-2.5" /> {fmt(post.likes)}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-white/40">
            <Bookmark className="h-2.5 w-2.5" /> {fmt(post.saves)}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-white/40">
            <MessageCircle className="h-2.5 w-2.5" /> {fmt(post.comments)}
          </span>
          {post.permalink && (
            <span
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(post.permalink!, "_blank", "noopener,noreferrer"); }}
              className="ml-auto text-white/20 hover:text-white/50 transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Sidebar tooltip ──────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] pointer-events-none"
      style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(20px)" }}>
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.payload.fill }}>{e.name}: {fmt(e.value)}</p>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PublicacionesGrid({ posts, summary }: PublicacionesGridProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | "post" | "carrusel">("all");

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (typeFilter === "carrusel") return p.media_type === "CAROUSEL_ALBUM";
      if (typeFilter === "post") return p.media_type !== "CAROUSEL_ALBUM";
      return true;
    });
  }, [posts, typeFilter]);

  const pieData = summary ? [
    { name: "Posts", value: summary.totalPosts },
    { name: "Carruseles", value: summary.totalCarruseles },
  ].filter(d => d.value > 0) : [];

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-14 w-14 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
          <Grid2X2 className="h-6 w-6 text-white/20" />
        </div>
        <h3 className="text-[15px] font-light text-white/50">Sin publicaciones en el período</h3>
        <p className="mt-2 text-[12px] text-white/25 font-light">
          Sincronizá tu cuenta de Instagram para ver posts y carruseles.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* ── Grid (main) ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {([
              { key: "all" as const, label: "Todos" },
              { key: "post" as const, label: "Posts" },
              { key: "carrusel" as const, label: "Carruseles" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  typeFilter === key ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/55"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-white/25">{filtered.length} publicaciones</span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* ── Summary sidebar ── */}
      <div className="w-[240px] shrink-0 space-y-4">
        {summary && (
          <>
            {/* Donut */}
            {pieData.length > 0 && (
              <div className="glass-card p-5">
                <p className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em] mb-4">Distribución</p>
                <div className="flex items-center gap-4">
                  <div className="h-[100px] w-[100px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={3} strokeWidth={0}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                        <div>
                          <p className="text-[10px] text-white/40">{d.name}</p>
                          <p className="text-[15px] font-light text-white">{d.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* KPIs */}
            <div className="glass-card p-5 space-y-4">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-[0.1em]">Totales</p>
              {[
                { label: "Me gusta", value: fmt(summary.totalLikes), icon: Heart },
                { label: "Guardados", value: fmt(summary.totalSaves), icon: Bookmark },
                { label: "Comentarios", value: fmt(summary.totalComments), icon: MessageCircle },
                { label: "Promedio likes", value: fmt(summary.avgLikes), icon: Eye },
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
          </>
        )}
      </div>
    </div>
  );
}
