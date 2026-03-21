export default function InstagramLoading() {
  return (
    <div className="px-8 py-10 space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-56 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-80 rounded bg-white/[0.04] mt-3" />
        </div>
        <div className="flex items-center gap-4">
          {/* Period filter skeleton */}
          <div className="flex gap-1 rounded-full p-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-12 rounded-full bg-white/[0.04]" />
            ))}
          </div>
          {/* Sync button skeleton */}
          <div className="h-10 w-32 rounded-full bg-white/[0.04]" />
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-full p-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-9 rounded-full ${i === 0 ? "w-24 bg-white/[0.08]" : "w-20 bg-white/[0.03]"}`} />
        ))}
      </div>

      {/* Hero KPIs — 4 large cards */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card px-6 py-5 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-3 w-24 rounded bg-white/[0.06]" />
                {i >= 2 && <div className="h-4 w-10 rounded-full bg-white/[0.04]" />}
              </div>
              <div className="h-8 w-20 rounded bg-white/[0.08]" />
            </div>
          ))}
        </div>

        {/* Secondary KPIs — 4 compact */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card px-6 py-5 flex flex-col justify-center">
              <div className="h-3 w-20 rounded bg-white/[0.06] mb-3" />
              <div className="h-8 w-16 rounded bg-white/[0.08]" />
            </div>
          ))}
        </div>
      </div>

      {/* Reels Grid skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl overflow-hidden">
            {/* Thumbnail */}
            <div className="aspect-[9/16] bg-white/[0.04] relative">
              <div className="absolute bottom-2 left-2 h-5 w-14 rounded-full bg-white/[0.06]" />
            </div>
            {/* Info */}
            <div className="p-3 space-y-2">
              <div className="h-3 w-full rounded bg-white/[0.04]" />
              <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
              <div className="flex gap-3 mt-2">
                <div className="h-3 w-12 rounded bg-white/[0.06]" />
                <div className="h-3 w-10 rounded bg-white/[0.04]" />
                <div className="h-3 w-10 rounded bg-white/[0.04]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
