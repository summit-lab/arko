"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type JobStatus = "idle" | "queued" | "running" | "completed" | "failed";

interface SyncJobProgress {
  /** Whether a sync job is actively running */
  isActive: boolean;
  /** Progress percentage 0-100 */
  progress: number;
  /** Current job status */
  status: JobStatus;
  /** Start polling for an active sync job */
  startTracking: () => void;
}

/**
 * Polls /api/v1/sync/status every 4s to track background sync progress.
 * Looks for the most recent full_sync job with status running/queued.
 * Auto-stops when job completes, fails, or after 3 minutes (safety).
 */
export function useSyncJobProgress(workspaceId: string): SyncJobProgress {
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [tracking, setTracking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const onCompleteRef = useRef<(() => void) | null>(null);
  // Solo concluimos "completed" si vimos correr el job nuevo: evita que un
  // full_sync completado de una corrida anterior corte el tracking apenas arranca.
  const sawActiveRef = useRef(false);

  const stopTracking = useCallback(() => {
    setTracking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    // Safety timeout: stop after 3 minutes
    if (Date.now() - startTimeRef.current > 3 * 60 * 1000) {
      stopTracking();
      setStatus("idle");
      return;
    }

    try {
      const res = await fetch(`/api/v1/sync/status?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      const json = await res.json();
      const jobs = json.data;
      if (!Array.isArray(jobs)) return;

      // Find most recent full_sync that is running or queued
      const activeJob = jobs.find(
        (j: { job_type: string; status: string }) =>
          j.job_type === "full_sync" && (j.status === "running" || j.status === "queued")
      );

      if (activeJob) {
        sawActiveRef.current = true;
        setStatus(activeJob.status as JobStatus);
        const total = activeJob.total_items || 0;
        const processed = activeJob.processed_items || 0;
        setProgress(total > 0 ? Math.min(Math.round((processed / total) * 100), 99) : 0);
      } else {
        // Si todavía no vimos arrancar el job nuevo, no concluir con uno viejo:
        // un full_sync completado de ANTES cortaría el tracking al instante.
        if (!sawActiveRef.current) return;
        // Check if the most recent full_sync completed
        const lastJob = jobs.find(
          (j: { job_type: string }) => j.job_type === "full_sync"
        );
        if (lastJob?.status === "completed" || lastJob?.status === "failed") {
          setStatus(lastJob.status as JobStatus);
          setProgress(lastJob.status === "completed" ? 100 : 0);
          stopTracking();
          onCompleteRef.current?.();
        }
      }
    } catch {
      // Network error, keep polling
    }
  }, [workspaceId, stopTracking]);

  const startTracking = useCallback(() => {
    setTracking(true);
    setStatus("queued");
    setProgress(0);
    startTimeRef.current = Date.now();
    sawActiveRef.current = false;

    // Start polling immediately, then every 4 seconds
    poll();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(poll, 4000);
  }, [poll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    isActive: tracking || status === "running" || status === "queued",
    progress,
    status,
    startTracking,
  };
}
