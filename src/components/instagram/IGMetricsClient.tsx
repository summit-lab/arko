"use client";

import dynamic from "next/dynamic";

const IGMetrics = dynamic(
  () => import("@/components/instagram/IGMetrics").then((m) => ({ default: m.IGMetrics })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
        <div className="h-64 rounded-2xl bg-white/[0.04]" />
      </div>
    ),
  }
);

export { IGMetrics as IGMetricsClient };
