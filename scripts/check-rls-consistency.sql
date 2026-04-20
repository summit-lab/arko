-- ═══════════════════════════════════════════════════════════════
-- RLS Consistency Check
-- ═══════════════════════════════════════════════════════════════
-- Detects tables with the "SELECT for members, WRITE only for service_role"
-- pattern, which silently fails when the app writes with the user's client.
--
-- This is the bug that caused competitor_follower_snapshots to be empty for
-- weeks (scraper ran fine, inserts failed silently due to RLS).
--
-- Run this:
--   * In dev before pushing to prod (via scripts/check-prod-parity.mjs)
--   * In CI on every PR that touches supabase/migrations/**
--
-- Any row returned = a new table with the silent-write-failure bug.
-- ═══════════════════════════════════════════════════════════════

WITH policy_detail AS (
  SELECT
    tablename,
    cmd,
    roles,
    CASE
      WHEN COALESCE(qual, '') LIKE '%is_workspace_member%'
        OR COALESCE(qual, '') LIKE '%workspace_members%'
        OR COALESCE(with_check, '') LIKE '%is_workspace_member%'
        OR COALESCE(with_check, '') LIKE '%workspace_members%'
        THEN 'workspace_members'
      ELSE 'other'
    END as role_group
  FROM pg_policies
  WHERE schemaname = 'public'
),
per_table AS (
  SELECT
    tablename,
    bool_or(cmd IN ('ALL', 'SELECT') AND role_group = 'workspace_members') as members_can_read,
    bool_or(cmd IN ('ALL', 'INSERT') AND role_group = 'workspace_members') as members_can_insert,
    bool_or(cmd IN ('ALL', 'UPDATE') AND role_group = 'workspace_members') as members_can_update
  FROM policy_detail
  GROUP BY tablename
)
-- Silent-write-failure bug pattern: members CAN read but CANNOT insert or update.
-- (DELETE is often intentionally restricted, so we don't check it here.)
SELECT
  tablename,
  CASE WHEN members_can_insert THEN 'ok' ELSE 'MISSING INSERT POLICY' END as insert_policy,
  CASE WHEN members_can_update THEN 'ok' ELSE 'MISSING UPDATE POLICY' END as update_policy
FROM per_table
WHERE members_can_read = true
  AND (members_can_insert = false OR members_can_update = false)
  -- Explicit exceptions: tables where workspace members are expected to be read-only.
  -- Add exceptions here ONLY if write was intentionally restricted and the app
  -- writes to the table via an admin client / RPC / edge function.
  AND tablename NOT IN (
    -- audit_logs: writes via service role only (through edge functions).
    'audit_logs',
    -- chat_messages: append-only by design (INSERT allowed, UPDATE intentionally blocked).
    'chat_messages',
    -- reel_diagnostics: append-only diagnostic records.
    'reel_diagnostics'
  );

-- If this returns any rows, the matching tables silently drop user-client writes.
-- The fix is to add a policy like:
--   CREATE POLICY "workspace_members_write_X"
--     ON <table> FOR ALL
--     USING (is_workspace_member(workspace_id))
--     WITH CHECK (is_workspace_member(workspace_id));
