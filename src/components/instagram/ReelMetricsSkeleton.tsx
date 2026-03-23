"use client";

export function ReelMetricsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="min-h-[100px] rounded-xl backdrop-blur-xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-4 w-20 rounded bg-white/[0.05] mb-4"></div>
            <div className="h-8 w-24 rounded bg-white/[0.08]"></div>
          </div>
        ))}
      </div>

      {/* Extended metrics */}
      <div className="rounded-xl backdrop-blur-xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-4 w-32 rounded bg-white/10 mb-3" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="rounded-lg bg-white/5 px-2 py-2 text-center">
              <div className="h-5 w-10 mx-auto rounded bg-white/15 mb-1" />
              <div className="h-2 w-12 mx-auto rounded bg-white/5" />
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-white/5 pt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg bg-white/5 px-2 py-1.5">
              <div className="h-2 w-14 rounded bg-white/10 mb-1" />
              <div className="h-4 w-10 rounded bg-white/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReelAnalysisSkeleton() {
  return (
    <div className="animate-pulse rounded-xl backdrop-blur-xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="h-4 w-40 rounded bg-white/10 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-white/6 p-4">
            <div className="h-3 w-20 rounded bg-white/10 mb-2" />
            <div className="h-5 w-16 rounded bg-white/15" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReelRetentionSkeleton() {
  return (
    <div className="animate-pulse rounded-xl backdrop-blur-xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="h-4 w-32 rounded bg-white/10 mb-4" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-3 w-32 rounded bg-white/10" />
              <div className="h-3 w-12 rounded bg-white/15" />
            </div>
            <div className="h-2.5 rounded-full bg-white/5">
              <div className="h-full rounded-full bg-white/10" style={{ width: `${80 - i * 20}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
