export default function ReelDetailLoading() {
  return (
    <div className="px-8 py-10 space-y-8 animate-pulse">
      {/* Back button */}
      <div className="h-8 w-32 rounded-lg bg-white/[0.04]" />

      <div className="grid grid-cols-12 gap-8">
        {/* Left — Thumbnail + basic info */}
        <div className="col-span-4 space-y-4">
          <div className="aspect-[9/16] rounded-xl bg-white/[0.04]" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-white/[0.04]" />
            <div className="h-4 w-3/4 rounded bg-white/[0.04]" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-lg bg-white/[0.04]" />
            <div className="h-8 w-20 rounded-lg bg-white/[0.04]" />
          </div>
        </div>

        {/* Right — Metrics */}
        <div className="col-span-8 space-y-6">
          {/* Quick stats row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card px-5 py-4">
                <div className="h-3 w-16 rounded bg-white/[0.06] mb-3" />
                <div className="h-7 w-20 rounded bg-white/[0.08]" />
              </div>
            ))}
          </div>

          {/* Extended metrics */}
          <div className="glass-card rounded-xl p-6">
            <div className="h-4 w-36 rounded bg-white/[0.06] mb-4" />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <div className="h-5 w-10 mx-auto rounded bg-white/[0.08] mb-1" />
                  <div className="h-2 w-14 mx-auto rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>

          {/* Analysis section */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-44 rounded bg-white/[0.06]" />
              <div className="h-9 w-40 rounded-lg bg-white/[0.04]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white/[0.03] p-4">
                  <div className="h-3 w-24 rounded bg-white/[0.06] mb-2" />
                  <div className="h-5 w-16 rounded bg-white/[0.08]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
