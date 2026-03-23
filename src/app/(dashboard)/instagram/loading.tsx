export default function InstagramLoading() {
  return (
    <div className="px-8 py-10 space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-56 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-80 rounded bg-white/[0.04] mt-3" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 rounded-full p-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-12 rounded-full bg-white/[0.04]" />
            ))}
          </div>
          <div className="h-10 w-32 rounded-full bg-white/[0.04]" />
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-9 rounded-md ${i === 0 ? "w-28 bg-white/[0.08]" : "w-20 bg-white/[0.03]"}`} />
        ))}
      </div>

      {/* Dashboard layout skeleton */}
      {/* Row 1: Chart + side KPIs */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 h-[320px] rounded-xl bg-white/[0.025]" />
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
          <div className="h-[148px] rounded-xl bg-white/[0.04]" />
          <div className="h-[148px] rounded-xl bg-white/[0.04]" />
        </div>
      </div>

      {/* Row 2: Three cards */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 md:col-span-4 h-[240px] rounded-xl bg-white/[0.04]" />
        <div className="col-span-12 md:col-span-4 h-[240px] rounded-xl bg-white/[0.04]" />
        <div className="col-span-12 md:col-span-4 h-[240px] rounded-xl bg-white/[0.04]" />
      </div>

      {/* Row 3: Recent reels strip */}
      <div className="h-[190px] rounded-xl bg-white/[0.025]" />
    </div>
  );
}
