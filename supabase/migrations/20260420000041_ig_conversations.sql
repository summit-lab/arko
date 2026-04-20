-- ═══════════════════════════════════════════════════════════════
-- Migration 000041: IG Conversations
-- Tracks new Instagram DM conversations per day via webhooks.
--
-- NOTE: the Sprint B spec references a table named "ig_accounts", but the
-- canonical IG identity in Arko lives in `meta_connections` (one row per
-- workspace, column `ig_business_account_id`). We FK against `meta_connections`
-- and store the IG business account id as text for fast lookup from webhook
-- payloads where Meta only sends the raw IG user id.
--
-- Designed for 100+ users × dozens of DMs/day × 365 days.
-- ═══════════════════════════════════════════════════════════════

-- ── Raw event log per webhook delivery ──────────────────────────
CREATE TABLE ig_conversation_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meta_connection_id uuid NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  ig_business_account_id text NOT NULL,
  event_type       text NOT NULL CHECK (event_type IN ('message_received','conversation_opened')),
  meta_event_id    text,
  thread_id        text NOT NULL,
  sender_igsid     text,
  is_first_inbound boolean NOT NULL DEFAULT false,
  event_at         timestamptz NOT NULL,
  raw_payload      jsonb NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ig_conv_events_workspace_date
  ON ig_conversation_events (workspace_id, event_at DESC);

CREATE INDEX idx_ig_conv_events_account_thread
  ON ig_conversation_events (meta_connection_id, thread_id);

CREATE UNIQUE INDEX idx_ig_conv_events_meta_id
  ON ig_conversation_events (meta_event_id)
  WHERE meta_event_id IS NOT NULL;

-- ── Daily aggregate (UI reads this) ─────────────────────────────
CREATE TABLE ig_daily_conversations (
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meta_connection_id uuid NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  date               date NOT NULL,
  new_conversations  integer NOT NULL DEFAULT 0,
  messages_received  integer NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meta_connection_id, date)
);

CREATE INDEX idx_ig_daily_conv_workspace
  ON ig_daily_conversations (workspace_id, date DESC);

-- ── Webhook subscription flag on meta_connections ──────────────
ALTER TABLE meta_connections
  ADD COLUMN IF NOT EXISTS webhook_subscribed boolean NOT NULL DEFAULT false;
ALTER TABLE meta_connections
  ADD COLUMN IF NOT EXISTS webhook_subscribed_at timestamptz;

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE ig_conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_daily_conversations ENABLE ROW LEVEL SECURITY;

-- Reads: workspace members. Writes: service role only (no INSERT/UPDATE policy).
CREATE POLICY "ig_conversation_events_select"
  ON ig_conversation_events FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "ig_daily_conversations_select"
  ON ig_daily_conversations FOR SELECT
  USING (is_workspace_member(workspace_id));
