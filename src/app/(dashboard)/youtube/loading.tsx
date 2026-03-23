export default function YouTubeLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-72 rounded bg-white/[0.04] mt-3" />
        </div>
        <div className="h-10 w-40 rounded-lg bg-white/[0.04]" />
      </div>

      {/* AI Insights */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-white/[0.04] flex-1" />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-4 text-center">
            <div className="h-4 w-4 rounded bg-white/[0.04] mx-auto mb-2" />
            <div className="h-6 w-14 rounded bg-white/[0.08] mx-auto" />
            <div className="h-2.5 w-20 rounded bg-white/[0.04] mx-auto mt-2" />
          </div>
        ))}
      </div>

      {/* Videos Table */}
      <div className="glass-card rounded-xl p-6">
        <div className="h-4 w-32 rounded bg-white/[0.06] mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3.5">
              <div className="h-12 w-20 rounded-lg bg-white/[0.04]" />
              <div className="flex-1">
                <div className="h-4 w-3/4 rounded bg-white/[0.04]" />
                <div className="h-2.5 w-20 rounded bg-white/[0.03] mt-1.5" />
              </div>
              <div className="h-3 w-10 rounded bg-white/[0.06]" />
              <div className="h-3 w-8 rounded bg-white/[0.04]" />
              <div className="h-3 w-8 rounded bg-white/[0.04]" />
              <div className="h-5 w-12 rounded-full bg-white/[0.06]" />
              <div className="h-3 w-10 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
