export default function AdnLoading() {
  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden">
      {/* Chat skeleton */}
      <div className="flex-[3] flex flex-col min-w-0">
        <div className="flex-1 py-6 px-8">
          <div className="space-y-4">
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-xl px-4 py-3 bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="h-4 w-4 rounded-full bg-white/[0.06] animate-pulse" />
                  <div className="h-2 w-8 rounded bg-white/[0.04] animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-80 rounded bg-white/[0.04] animate-pulse" />
                  <div className="h-3 w-64 rounded bg-white/[0.03] animate-pulse" />
                  <div className="h-3 w-72 rounded bg-white/[0.04] animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 px-8 pb-6 pt-3">
          <div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 pt-3.5 pb-3 flex items-center">
              <div className="flex-1 h-4 rounded bg-white/[0.03] animate-pulse" />
              <div className="ml-3 h-9 w-9 rounded-lg bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Docs panel skeleton */}
      <aside className="flex-[2] min-w-[320px] max-w-[480px] p-5 border-l border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-baseline justify-between mb-2.5">
          <div className="h-2.5 w-10 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-5 w-12 rounded bg-white/[0.04] animate-pulse" />
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] mb-4 animate-pulse" />
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="h-6 w-6 rounded-full bg-white/[0.04] shrink-0 animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 w-24 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-2 w-16 rounded bg-white/[0.03] animate-pulse" />
              </div>
              <div className="h-3 w-3 rounded bg-white/[0.03] animate-pulse" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
