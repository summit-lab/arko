"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface UseNewContentPollingOptions {
  workspaceId: string;
  /** Polling interval in ms. Default 3 minutes */
  intervalMs?: number;
  /** Whether polling is active. Default true */
  enabled?: boolean;
  /** Called when new content is detected */
  onNewContent?: (count: number) => void;
}

interface PollingState {
  hasNewContent: boolean;
  newCount: number;
  isChecking: boolean;
}

/**
 * Polls Instagram for new media every N minutes.
 * Lightweight — only checks latest 5 media IDs vs DB (~1-2s).
 * Does NOT auto-sync; just notifies so UI can show a badge/prompt.
 */
export function useNewContentPolling({
  workspaceId,
  intervalMs = 3 * 60 * 1000,
  enabled = true,
  onNewContent,
}: UseNewContentPollingOptions): PollingState & { checkNow: () => void; dismiss: () => void } {
  const [state, setState] = useState<PollingState>({
    hasNewContent: false,
    newCount: 0,
    isChecking: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onNewContentRef = useRef(onNewContent);
  onNewContentRef.current = onNewContent;

  const check = useCallback(async () => {
    if (!workspaceId) return;
    setState((s) => ({ ...s, isChecking: true }));

    try {
      const res = await fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=check`,
        { method: "POST" }
      );
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data;

      if (data?.has_new_content && data.new_count > 0) {
        setState({ hasNewContent: true, newCount: data.new_count, isChecking: false });
        onNewContentRef.current?.(data.new_count);
      } else {
        setState((s) => ({ ...s, isChecking: false }));
      }
    } catch {
      setState((s) => ({ ...s, isChecking: false }));
    }
  }, [workspaceId]);

  const dismiss = useCallback(() => {
    setState({ hasNewContent: false, newCount: 0, isChecking: false });
  }, []);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    // First check after 30s (let page settle)
    const initialTimeout = setTimeout(check, 30_000);

    // Then poll every intervalMs
    intervalRef.current = setInterval(check, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, workspaceId, intervalMs, check]);

  return { ...state, checkNow: check, dismiss };
}
