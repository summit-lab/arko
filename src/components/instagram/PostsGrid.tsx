"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Eye, Heart, Bookmark, MessageSquare, Share2,
  Image as ImageIcon, Layers, Clock, ArrowUpRight,
  ChevronDown, ArrowUpDown, Check,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  permalink: string | null;
  published_at: string | null;
  media_type: string | null;
  media_product_type: string | null;
  impressions: number;
  reach: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
}

interface PostsGridProps {
  posts: Post[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
}

// ─── Filter config ────────────────────────────────────────────────────────────

type SortKey = "impressions" | "reach" | "likes" | "saves" | "comments" | "shares" | "published_at";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "published_at", label: "Fecha" },
  { value: "impressions", label: "Impresiones" },
  { value: "reach", label: "Alcance" },
  { value: "likes", label: "Likes" },
  { value: "saves", label: "Guardados" },
  { value: "comments", label: "Comentarios" },
  { value: "shares", label: "Compartidos" },
];

// ─── Select ───────────────────────────────────────────────────────────────────

function Select({ value, onChange, options, className = "" }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/8"
      >
        <span>{selected?.label}</span>
        <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-2xl shadow-black/50 backdrop-blur-2xl">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-6 px-3 py-2 text-[11px] font-medium transition-colors hover:bg-white/8 ${o.value === value ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <span>{o.label}</span>
              {o.value === value && <Check className="h-3 w-3 text-white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PostsGrid({ posts }: PostsGridProps) {
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const sorted = useMemo(() => {
    const result = [...posts];
    result.sort((a, b) => {
      let aVal: number;
      let bVal: number;
      if (sortKey === "published_at") {
        aVal = a.published_at ? new Date(a.published_at).getTime() : 0;
        bVal = b.published_at ? new Date(b.published_at).getTime() : 0;
      } else {
        aVal = a[sortKey] as number;
        bVal = b[sortKey] as number;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [posts, sortKey, sortDir]);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ImageIcon className="h-12 w-12 text-zinc-600 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-300">Sin posts</h3>
        <p className="mt-2 text-sm text-zinc-500 max-w-md">
          Sincroniza tu cuenta de Instagram para ver tus posts e imágenes aquí.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100">Posts</h2>
            <span className="text-[11px] text-zinc-500">{sorted.length} posts</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 whitespace-nowrap">Ordenar por</span>
            <Select value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={SORT_OPTIONS} className="w-40" />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-zinc-200 text-[11px] font-medium rounded-lg px-3 py-1.5 hover:bg-white/8 hover:border-white/20 transition-colors"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortDir === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
        {sorted.map((post) => {
          const isCarousel = post.media_type === "CAROUSEL_ALBUM";
          const imageUrl = post.thumbnail_url || post.media_url;

          return (
            <div
              key={post.id}
              className="group overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-xl shadow-black/20 transition-all hover:border-white/20 hover:bg-black/40"
            >
              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-pink-500/10 to-purple-500/10">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-white/20" />
                  </div>
                )}
                {isCarousel && (
                  <div className="absolute top-2 right-2 rounded bg-black/70 p-1 backdrop-blur-sm">
                    <Layers className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 left-2 rounded bg-black/70 p-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-white" />
                  </a>
                )}
              </div>

              <div className="p-3 space-y-2">
                {post.caption && (
                  <p className="line-clamp-2 text-[11px] leading-snug text-zinc-200">
                    {post.caption.length > 80 ? post.caption.slice(0, 80) + "..." : post.caption}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2">
                  {[
                    { icon: Heart, value: post.likes, color: "text-rose-300" },
                    { icon: Bookmark, value: post.saves, color: "text-amber-300" },
                    { icon: MessageSquare, value: post.comments, color: "text-emerald-300" },
                    { icon: Share2, value: post.shares, color: "text-blue-300" },
                  ].map((m, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div className={`flex items-center gap-1 text-[10px] font-semibold ${m.color}`}>
                        <m.icon className="h-2.5 w-2.5" />
                        <span>{formatNumber(m.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[9px] font-medium text-zinc-500">
                  <span>{post.published_at ? timeAgo(post.published_at) : "--"}</span>
                  <div className="flex items-center gap-2">
                    {post.reach > 0 && <span>Alcance {formatNumber(post.reach)}</span>}
                    {post.impressions > 0 && <span>Impr. {formatNumber(post.impressions)}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
