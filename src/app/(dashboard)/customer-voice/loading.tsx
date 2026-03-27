export default function CustomerVoiceLoading() {
  return (
    <div className="px-8 py-10 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-80 rounded bg-white/[0.04] mt-3" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-white/[0.04]" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 w-28 rounded bg-white/[0.04]" />
              <div className="h-9 w-9 rounded-full bg-white/[0.06]" />
            </div>
            <div className="h-7 w-12 rounded bg-white/[0.08]" />
          </div>
        ))}
      </div>

      {/* Identity & Audience */}
      <div className="grid grid-cols-12 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="col-span-6 glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
              <div className="h-4 w-40 rounded bg-white/[0.06]" />
            </div>
            <div className="space-y-5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j}>
                  <div className="h-2.5 w-24 rounded bg-white/[0.04] mb-2" />
                  <div className="h-4 w-full rounded bg-white/[0.04]" />
                  <div className="h-4 w-3/4 rounded bg-white/[0.03] mt-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Brand & Market */}
      <div className="grid grid-cols-12 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="col-span-6 glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
              <div className="h-4 w-36 rounded bg-white/[0.06]" />
            </div>
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j}>
                  <div className="h-2.5 w-28 rounded bg-white/[0.04] mb-2" />
                  <div className="h-4 w-full rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Competitors & References */}
      <div className="grid grid-cols-12 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="col-span-6 glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
              <div className="h-4 w-32 rounded bg-white/[0.06]" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="p-4 rounded-xl bg-white/[0.03]">
                  <div className="h-3.5 w-32 rounded bg-white/[0.06] mb-2" />
                  <div className="h-3 w-full rounded bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
