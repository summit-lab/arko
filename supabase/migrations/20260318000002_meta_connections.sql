-- Migration 2: Meta OAuth connections
-- Creates: meta_connections table for OAuth tokens and Meta asset IDs
-- PRD sections: 4.1-4.6

CREATE TABLE meta_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- OAuth tokens (encrypted at rest with pgcrypto)
  access_token_encrypted  bytea,
  token_expires_at        timestamptz,
  token_type              text DEFAULT 'long_lived',

  -- Facebook user info
  fb_user_id              text,

  -- Page connected
  page_id                 text,
  page_name               text,
  page_access_token_enc   bytea,

  -- Instagram Business Account (resolved from page)
  ig_business_account_id  text,
  ig_username             text,

  -- Ad Accounts (can have multiple)
  ad_account_ids          text[] DEFAULT '{}',

  -- Permissions granted by user
  permissions_granted     text[] DEFAULT '{}',

  -- Connection health
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
  last_error              text,
  last_validated_at       timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id)
);

CREATE INDEX idx_meta_connections_workspace ON meta_connections(workspace_id);
CREATE INDEX idx_meta_connections_status ON meta_connections(status);
CREATE INDEX idx_meta_connections_ig_account ON meta_connections(ig_business_account_id);

CREATE TRIGGER meta_connections_updated_at
  BEFORE UPDATE ON meta_connections
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
