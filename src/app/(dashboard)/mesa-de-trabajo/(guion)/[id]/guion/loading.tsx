// The sidebar is rendered by layout.tsx and stays mounted across navigations,
// so this loading state only covers the editor pane. Rendering a fake sidebar
// here would flash twice (real → fake → real) when switching scripts.
export default function GuionLoading() {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
        <div className="h-4 w-64 rounded bg-white/[0.05] animate-pulse" />
        <div className="h-4 w-24 rounded bg-white/[0.04] animate-pulse" />
      </div>

      {/* Title + body */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-[720px] mx-auto px-8 py-16 flex flex-col gap-8">
          <div className="h-12 w-3/4 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-1/3 rounded bg-white/[0.04] animate-pulse" />
          <div className="flex flex-col gap-3 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-5 rounded bg-white/[0.04] animate-pulse"
                style={{ width: `${85 - (i % 3) * 15}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
