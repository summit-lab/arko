export default function CompetitorReelDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-6 py-8 sm:px-10 lg:px-[4%] animate-pulse">
      <div className="h-4 w-32 rounded bg-white/[0.06]" />
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-white/[0.06]" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 rounded bg-white/[0.06]" />
          <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06]" style={{ aspectRatio: "9/14.8" }} />
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
            ))}
          </div>
          <div className="h-20 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="h-64 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
        <div className="h-64 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
      </div>
    </div>
  );
}
