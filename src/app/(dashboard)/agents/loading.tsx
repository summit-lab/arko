export default function ArkoAILoading() {
  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden animate-pulse">
      {/* Session sidebar skeleton */}
      <aside className="w-60 shrink-0 border-r border-white/[0.06] bg-white/[0.01] flex flex-col p-3 space-y-2">
        <div className="h-10 rounded-xl bg-white/[0.06]" />
        <div className="space-y-1.5 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      </aside>

      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 py-6 px-8">
          <div className="max-w-3xl mx-auto flex flex-col items-center justify-center h-full">
            <div className="h-16 w-16 rounded-2xl bg-white/[0.04] mb-6" />
            <div className="h-5 w-64 rounded bg-white/[0.06] mb-3" />
            <div className="h-3 w-80 rounded bg-white/[0.03] mb-8" />
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-white/[0.03]" />
              ))}
            </div>
          </div>
        </div>
        <div className="px-8 pb-6 pt-3">
          <div className="max-w-3xl mx-auto">
            <div className="h-12 rounded-xl bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  );
}
