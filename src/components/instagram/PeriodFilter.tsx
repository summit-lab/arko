"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";

const PERIODS = [
  { label: "7d",  value: "7"  },
  { label: "14d", value: "14" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
] as const;

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const current = searchParams.get("days") || "90";

  const handleSelect = useCallback((value: string) => {
    if (value === current) return;
    window.dispatchEvent(new Event("nav:start"));
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", value);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }, [router, searchParams, current]);

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
      {PERIODS.map((p) => {
        const active = current === p.value;
        return (
          <button
            key={p.value}
            onClick={() => handleSelect(p.value)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-250 cursor-pointer border ${
              active
                ? "text-white bg-white/[0.1] border-white/[0.1]"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border-transparent"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
