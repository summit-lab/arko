-- Migration 11: Extend reel_benchmarks with composite metrics + UPSERT support
-- Adds: avg_engagement_rate, avg_retention_rate, avg_duration_seconds, avg_reach_per_view, avg_saves_per_reach
-- Adds: UNIQUE constraint on workspace_id for UPSERT (one snapshot per workspace)
-- Adds: UPDATE RLS policy (required for UPSERT)
-- Applied to DEV via Windsurf on 2026-03-23, PROD via Claude Code on 2026-03-23

-- =============================================================
-- 1. ADD NEW COLUMNS
-- =============================================================
ALTER TABLE reel_benchmarks
  ADD COLUMN IF NOT EXISTS avg_engagement_rate    real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_retention_rate     real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_duration_seconds   real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_reach_per_view     real DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_saves_per_reach    real DEFAULT 0;

-- =============================================================
-- 2. UNIQUE CONSTRAINT on workspace_id (enables UPSERT)
-- Only one benchmark snapshot per workspace (latest wins)
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reel_benchmarks'::regclass
    AND conname = 'reel_benchmarks_workspace_id_unique'
  ) THEN
    -- Remove duplicate rows keeping only the most recent per workspace
    DELETE FROM reel_benchmarks a
    USING reel_benchmarks b
    WHERE a.workspace_id = b.workspace_id
      AND a.calculated_at < b.calculated_at;

    ALTER TABLE reel_benchmarks
      ADD CONSTRAINT reel_benchmarks_workspace_id_unique UNIQUE (workspace_id);
  END IF;
END;
$$;

-- =============================================================
-- 3. UPDATE RLS POLICY (required for UPSERT)
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reel_benchmarks'
    AND policyname = 'reel_benchmarks_update'
  ) THEN
    CREATE POLICY "reel_benchmarks_update"
      ON reel_benchmarks FOR UPDATE
      USING (is_workspace_member(workspace_id));
  END IF;
END;
$$;
