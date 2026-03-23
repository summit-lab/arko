export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      {/* Title */}
      <div>
        <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-72 rounded bg-white/[0.04] mt-3" />
      </div>

      {/* ROW 1: Chart + Goals + Numbers */}
      <div className="grid grid-cols-12 gap-6">
        {/* Chart */}
        <div className="col-span-5 glass-card rounded-2xl p-6">
          <div className="h-4 w-40 rounded bg-white/[0.06] mb-4" />
          <div className="flex items-end gap-3 h-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 flex gap-0.5 items-end justify-center h-32">
                <div className="w-3 rounded-t bg-white/[0.06]" style={{ height: `${40 + (i * 17 % 50)}%` }} />
                <div className="w-3 rounded-t bg-white/[0.04]" style={{ height: `${20 + (i * 13 % 40)}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="col-span-4 glass-card rounded-2xl p-6">
          <div className="h-4 w-32 rounded bg-white/[0.06] mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1.5">
                  <div className="h-3 w-20 rounded bg-white/[0.04]" />
                  <div className="h-3 w-16 rounded bg-white/[0.06]" />
                </div>
                <div className="h-2 w-full rounded-full bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>

        {/* Key Numbers */}
        <div className="col-span-3 grid grid-rows-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="h-2.5 w-16 rounded bg-white/[0.04] mb-2" />
                <div className="h-6 w-12 rounded bg-white/[0.06]" />
              </div>
              <div className="h-5 w-5 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>

      {/* ROW 2: Country + Top Content */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 glass-card rounded-2xl p-6">
          <div className="h-4 w-32 rounded bg-white/[0.06] mb-4" />
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, col) => (
              <div key={col} className="space-y-3">
                <div className="h-3 w-16 rounded bg-white/[0.04]" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-3 w-20 rounded bg-white/[0.04]" />
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.04]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-7 glass-card rounded-2xl p-6">
          <div className="h-4 w-44 rounded bg-white/[0.06] mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="h-10 w-10 rounded-lg bg-white/[0.04]" />
                <div className="flex-1 h-4 rounded bg-white/[0.04]" />
                <div className="h-3 w-10 rounded bg-white/[0.06]" />
                <div className="h-3 w-10 rounded bg-white/[0.04]" />
                <div className="h-3 w-10 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
