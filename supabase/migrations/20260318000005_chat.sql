-- Migration 5: Chat sessions, messages, and audit logs
-- PRD sections: 8.3, 9.1, 9.4

-- =============================================================
-- CHAT_SESSIONS — Analytical chat sessions
-- PRD 8.3: Chat analítico
-- =============================================================
CREATE TABLE chat_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title             text DEFAULT 'Nueva conversación',
  is_active         boolean NOT NULL DEFAULT true,

  -- Context: which reel(s) are being discussed (optional)
  context_reel_ids  uuid[] DEFAULT '{}',

  -- Token usage tracking
  total_tokens_used int NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_workspace ON chat_sessions(workspace_id);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- CHAT_MESSAGES — Individual messages in a chat session
-- =============================================================
CREATE TABLE chat_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  role              text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content           text NOT NULL,

  -- Grounding: what data was used to generate this response
  grounding_data    jsonb DEFAULT '{}',

  -- Which reels were referenced in this message
  referenced_reels  uuid[] DEFAULT '{}',

  -- Token usage for this message
  tokens_used       int DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_workspace ON chat_messages(workspace_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(session_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- AUDIT_LOGS — Audit trail for AI responses (grounding evidence)
-- PRD 3.1: Auditoría de respuestas del chat
-- =============================================================
CREATE TABLE audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What action was audited
  action_type       text NOT NULL
                    CHECK (action_type IN ('chat_response', 'reel_diagnosis', 'reel_analysis', 'sync_completed')),

  -- Reference to the entity
  entity_type       text,
  entity_id         uuid,

  -- The AI response and evidence used
  request_summary   text,
  response_summary  text,
  evidence_used     jsonb DEFAULT '{}',

  -- Metadata
  llm_model         text,
  tokens_used       int DEFAULT 0,
  latency_ms        int,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created ON audit_logs(workspace_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
