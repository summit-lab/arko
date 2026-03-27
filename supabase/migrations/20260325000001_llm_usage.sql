-- ─── LLM Usage Tracking ──────────────────────────────────────────────────────
-- Records every LLM API call with token counts, model, and calculated cost.
-- Used by the admin panel to monitor spend and usage per workspace.

CREATE TABLE IF NOT EXISTS llm_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature       text NOT NULL,          -- 'onboarding-adn', 'ai-agents', etc.
  provider      text NOT NULL,          -- 'openai', 'anthropic'
  model         text NOT NULL,          -- 'gpt-4.1-mini', 'claude-sonnet-4-5-20241022', etc.
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens  integer NOT NULL DEFAULT 0,
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0, -- calculated cost in USD
  latency_ms    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common admin queries
CREATE INDEX idx_llm_usage_workspace ON llm_usage(workspace_id);
CREATE INDEX idx_llm_usage_created   ON llm_usage(created_at DESC);
CREATE INDEX idx_llm_usage_model     ON llm_usage(model);

-- RLS
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Admins can read all usage
CREATE POLICY "Admins can read all llm_usage"
  ON llm_usage FOR SELECT
  TO authenticated
  USING (is_admin());

-- Insert allowed for authenticated users (server-side only via service role in practice)
CREATE POLICY "Authenticated users can insert own usage"
  ON llm_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
