export default function MesaDeTrabajoLoading() {
  return (
    <div className="flex flex-col h-full px-6 py-8 gap-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-52 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-72 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-white/[0.06] animate-pulse" />
      </div>

      {/* View switcher skeleton */}
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded-lg bg-white/[0.06] animate-pulse" />
        <div className="h-8 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
      </div>

      {/* Kanban columns skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[260px] rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 flex flex-col gap-2"
          >
            <div className="h-5 w-28 rounded-md bg-white/[0.06] animate-pulse mb-1" />
            {Array.from({ length: i % 2 === 0 ? 3 : 2 }).map((_, j) => (
              <div
                key={j}
                className="h-[80px] rounded-lg bg-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
