"use client";

import { useState } from "react";
import { Play } from "lucide-react";

interface ReelItem {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  views_total: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function ReelCard({ reel, idx }: { reel: ReelItem; idx: number }) {
  const [errored, setErrored] = useState(false);
  const showImage = reel.thumbnail_url && !errored;

  return (
    <a
      href={`/instagram/${reel.id}`}
      className="flex-shrink-0 group cursor-pointer"
    >
      <div className="relative w-[88px] h-[128px] rounded-lg overflow-hidden mb-1.5 transition-transform duration-200 group-hover:scale-[1.03] bg-white/[0.04] border border-white/[0.06]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reel.thumbnail_url!}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setErrored(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Play className="h-5 w-5 text-white/15" />
          </div>
        )}
        <div
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm"
          style={{ backgroundColor: "rgba(0,0,0,0.72)", color: "#ffffff" }}
        >
          #{idx + 1}
        </div>
      </div>
      <p className="text-[11px] font-light text-white/50 text-center">{fmt(reel.views_total)}</p>
    </a>
  );
}

export function RecentReelsStrip({ reels, label }: { reels: ReelItem[]; label: string }) {
  if (reels.length === 0) return null;
  return (
    <div className="glass-section p-6 animate-slide-up stagger-6">
      <p className="stat-label mb-4">{label}</p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {reels.map((reel, idx) => (
          <ReelCard key={reel.id} reel={reel} idx={idx} />
        ))}
      </div>
    </div>
  );
}
