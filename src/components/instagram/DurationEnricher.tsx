"use client";

/**
 * DurationEnricher
 * Fire-and-forget: triggers /api/v1/reels/enrich-durations when there are
 * reels missing duration_seconds. On completion, refreshes the page so
 * cards show the correct duration badge.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface DurationEnricherProps {
  workspaceId: string;
  /** Number of reels currently missing duration_seconds */
  missingCount: number;
}

export function DurationEnricher({ workspaceId, missingCount }: DurationEnricherProps) {
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current || missingCount === 0) return;
    didRun.current = true;

    (async () => {
      try {
        const res = await fetch("/api/v1/reels/enrich-durations", {
          method: "POST",
          headers: { "x-workspace-id": workspaceId },
        });

        if (res.ok) {
          const { data } = await res.json() as { data: { enriched: number; total: number } };
          if (data.enriched > 0) {
            // Refresh the page to show updated durations (soft refresh, no full reload)
            router.refresh();
          }
        }
      } catch {
        // Silent — enrichment is best-effort
      }
    })();
  }, [workspaceId, missingCount, router]);

  return null;
}
