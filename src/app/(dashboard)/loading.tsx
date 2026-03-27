export default function DashboardLoading() {
  return (
    <div className="px-8 py-10 animate-pulse">
      {/* Title */}
      <div className="mb-10">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-72 rounded bg-white/[0.04] mt-3" />
      </div>

      {/* Main 70/30 Layout */}
      <div className="flex gap-6">
        {/* LEFT */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Hero KPIs */}
          <div className="grid grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-3 w-20 rounded bg-white/[0.04]" />
                  <div className="h-9 w-9 rounded-full bg-white/[0.04]" />
                </div>
                <div className="h-8 w-20 rounded bg-white/[0.06] mb-3" />
                <div className="h-3 w-16 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-xl p-6">
                <div className="h-4 w-32 rounded bg-white/[0.06] mb-6" />
                <div className="h-[200px] flex items-end gap-3">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} className="flex-1 flex gap-1 items-end justify-center h-full">
                      <div className="w-3 rounded-t bg-white/[0.06]" style={{ height: `${30 + (j * 17 % 50)}%` }} />
                      <div className="w-3 rounded-t bg-white/[0.04]" style={{ height: `${15 + (j * 13 % 40)}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Top Content */}
          <div className="glass-panel rounded-xl p-6">
            <div className="h-4 w-44 rounded bg-white/[0.06] mb-5" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3.5">
                  <div className="h-9 w-9 rounded-lg bg-white/[0.04]" />
                  <div className="flex-1 h-4 rounded bg-white/[0.04]" />
                  <div className="h-3 w-12 rounded bg-white/[0.06]" />
                  <div className="h-3 w-10 rounded bg-white/[0.04]" />
                  <div className="h-3 w-10 rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-[320px] shrink-0 space-y-6">
          {/* Quick Stats */}
          <div className="glass-panel rounded-xl p-6">
            <div className="h-3 w-28 rounded bg-white/[0.06] mb-5" />
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <div className="h-3 w-24 rounded bg-white/[0.04]" />
                    <div className="h-2.5 w-16 rounded bg-white/[0.03] mt-1" />
                  </div>
                  <div className="h-6 w-14 rounded bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>

          {/* Top Países */}
          <div className="glass-panel rounded-xl p-6">
            <div className="h-3 w-24 rounded bg-white/[0.06] mb-5" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded bg-white/[0.04]" />
                  <div className="h-3 w-16 rounded bg-white/[0.04]" />
                  <div className="flex-1 h-1 rounded-full bg-white/[0.04]" />
                  <div className="h-3 w-6 rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
