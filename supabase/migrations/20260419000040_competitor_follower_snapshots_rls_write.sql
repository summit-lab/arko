-- ═══════════════════════════════════════════════════════════════
-- Allow workspace members to WRITE competitor_follower_snapshots
-- ═══════════════════════════════════════════════════════════════
-- Migration 33 created read-only policy for workspace members and write-only
-- policy for service_role. But `scrapeCompetitor` runs with the user's anon
-- client (not service_role), so the upsert silently failed due to RLS — leaving
-- the table empty and the "SEGUIDORES - CRECIMIENTO" chart without competitor
-- data.
--
-- Fix: add an INSERT/UPDATE policy for workspace members. Pattern matches
-- `workspace_competitors` and other workspace-scoped tables in the codebase.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'competitor_follower_snapshots'
      AND policyname = 'workspace_members_write_follower_snapshots'
  ) THEN
    CREATE POLICY "workspace_members_write_follower_snapshots"
      ON competitor_follower_snapshots
      FOR ALL
      USING (is_workspace_member(workspace_id))
      WITH CHECK (is_workspace_member(workspace_id));
  END IF;
END $$;
