"use client";

import dynamic from "next/dynamic";

const IGDashboard = dynamic(
  () => import("@/components/instagram/IGDashboard").then((m) => ({ default: m.IGDashboard })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-5">
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 h-[320px] rounded-xl bg-white/[0.025]" />
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
            <div className="h-[148px] rounded-xl bg-white/[0.04]" />
            <div className="h-[148px] rounded-xl bg-white/[0.04]" />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-4 h-[240px] rounded-xl bg-white/[0.04]" />
          <div className="col-span-12 md:col-span-4 h-[240px] rounded-xl bg-white/[0.04]" />
          <div className="col-span-12 md:col-span-4 h-[240px] rounded-xl bg-white/[0.04]" />
        </div>
        <div className="h-[180px] rounded-xl bg-white/[0.025]" />
      </div>
    ),
  }
);

export type { IGDashboardProps } from "@/components/instagram/IGDashboard";
export { IGDashboard as IGDashboardClient };
