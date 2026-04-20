"use client";

export function ReelMetricsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="min-h-[100px] rounded-xl p-5 bg-muted/40 border border-border">
            <div className="h-4 w-20 rounded bg-muted/60 mb-4"></div>
            <div className="h-8 w-24 rounded bg-muted"></div>
          </div>
        ))}
      </div>

      {/* Extended metrics */}
      <div className="rounded-xl p-6 bg-muted/30 border border-border">
        <div className="h-4 w-32 rounded bg-muted mb-3" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="rounded-lg bg-muted/60 px-2 py-2 text-center">
              <div className="h-5 w-10 mx-auto rounded bg-muted mb-1" />
              <div className="h-2 w-12 mx-auto rounded bg-muted/60" />
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg bg-muted/60 px-2 py-1.5">
              <div className="h-2 w-14 rounded bg-muted mb-1" />
              <div className="h-4 w-10 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReelAnalysisSkeleton() {
  return (
    <div className="animate-pulse rounded-xl p-6 bg-muted/30 border border-border">
      <div className="h-4 w-40 rounded bg-muted mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-muted/60 p-4">
            <div className="h-3 w-20 rounded bg-muted mb-2" />
            <div className="h-5 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReelRetentionSkeleton() {
  return (
    <div className="animate-pulse rounded-xl p-6 bg-muted/30 border border-border">
      <div className="h-4 w-32 rounded bg-muted mb-4" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-3 w-32 rounded bg-muted" />
              <div className="h-3 w-12 rounded bg-muted" />
            </div>
            <div className="h-2.5 rounded-full bg-muted/60">
              <div className="h-full rounded-full bg-muted" style={{ width: `${80 - i * 20}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
