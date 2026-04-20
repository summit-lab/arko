-- ═══════════════════════════════════════════════════════════════
-- Migration 000044: Data Deletion Requests (Meta App Review)
-- Tracks data-deletion requests received via POST /api/data-deletion-callback
-- so the confirmation page at /data-deletion?code=<uuid> can show the
-- user the status of their request.
--
-- Designed for low-volume writes (a handful per week at most) but the
-- code column is UUID-indexed so lookups from the public status page
-- are instant regardless of row count.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE data_deletion_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Public confirmation code — returned to Meta and surfaced on /data-deletion
  code                    uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Meta's `user_id` from signed_request (IGSID for IG, FB user id otherwise).
  -- Stored as text because Meta uses opaque string ids.
  signed_request_user_id  text NOT NULL,
  -- 'pending' when enqueued, 'completed' once rows have been wiped.
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'completed')),
  -- How many ig_conversation_events rows the callback removed.
  rows_deleted            integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz
);

CREATE INDEX idx_data_deletion_requests_user_id
  ON data_deletion_requests (signed_request_user_id);

-- RLS: callers hit this from a public status page (no auth) via the
-- service role through a server action. Keep RLS enabled so nothing
-- leaks through the anon key, and do not declare SELECT policies —
-- the public page uses the service role via the server.
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
