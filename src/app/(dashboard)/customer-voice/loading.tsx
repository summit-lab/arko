export default function CustomerVoiceLoading() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-80 rounded bg-white/[0.04] mt-3" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-36 rounded-lg bg-white/[0.04]" />
          <div className="h-10 w-32 rounded-lg bg-white/[0.04]" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl p-4 text-center">
            <div className="h-4 w-4 rounded bg-white/[0.04] mx-auto mb-2" />
            <div className="h-6 w-12 rounded bg-white/[0.08] mx-auto" />
            <div className="h-2.5 w-24 rounded bg-white/[0.04] mx-auto mt-2" />
          </div>
        ))}
      </div>

      {/* Form Responses + Pain Points */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7 glass-card rounded-2xl p-6">
          <div className="h-4 w-52 rounded bg-white/[0.06] mb-5" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.03]">
                <div className="h-3 w-3/4 rounded bg-white/[0.06] mb-2" />
                <div className="h-4 w-full rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="h-4 w-40 rounded bg-white/[0.06] mb-5" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <div className="h-3 w-44 rounded bg-white/[0.04]" />
                    <div className="h-3 w-16 rounded bg-white/[0.03]" />
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="h-4 w-32 rounded bg-white/[0.06] mb-5" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-white/[0.03]" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calls */}
      <div className="glass-card rounded-2xl p-6">
        <div className="h-4 w-52 rounded bg-white/[0.06] mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-white/[0.03]">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-white/[0.04]" />
                <div>
                  <div className="h-3.5 w-24 rounded bg-white/[0.06]" />
                  <div className="h-2.5 w-20 rounded bg-white/[0.03] mt-1" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-white/[0.04] mb-2" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-5 w-24 rounded bg-white/[0.04]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
