-- ═══════════════════════════════════════════════════════════════
-- Google OAuth connections (YouTube + Analytics)
-- ═══════════════════════════════════════════════════════════════
-- Mirrors the pattern established for meta_connections:
--   * one row per workspace
--   * encrypted access_token / refresh_token via pgcrypto
--   * access via three SECURITY DEFINER RPCs:
--       save_google_connection       — upsert with encryption
--       get_google_access_token      — decrypt + return access token
--       get_google_refresh_token     — decrypt + return refresh token
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS google_connections (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id               uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- OAuth tokens encrypted at rest
  access_token_encrypted     bytea,
  refresh_token_encrypted    bytea,
  token_expires_at           timestamptz,

  -- Google user info
  google_user_id             text,
  google_email               text,

  -- YouTube channel info
  yt_channel_id              text,
  yt_channel_title           text,

  -- Scopes granted by user
  scopes_granted             text[] DEFAULT '{}',

  -- Connection health
  status                     text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
  last_error                 text,
  last_validated_at          timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_google_connections_workspace ON google_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_connections_status ON google_connections(status);
CREATE INDEX IF NOT EXISTS idx_google_connections_yt_channel ON google_connections(yt_channel_id);

DROP TRIGGER IF EXISTS google_connections_updated_at ON google_connections;
CREATE TRIGGER google_connections_updated_at
  BEFORE UPDATE ON google_connections
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;

-- RLS: members of the workspace can read and write.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'google_connections'
      AND policyname = 'workspace_members_own_google_connections'
  ) THEN
    CREATE POLICY "workspace_members_own_google_connections"
      ON google_connections FOR ALL
      USING (is_workspace_member(workspace_id));
  END IF;
END $$;

-- =============================================================
-- SAVE_GOOGLE_CONNECTION RPC — encrypts tokens with pgcrypto
-- =============================================================
CREATE OR REPLACE FUNCTION save_google_connection(
  p_workspace_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_encryption_key text,
  p_token_expires_at timestamptz,
  p_google_user_id text,
  p_google_email text,
  p_yt_channel_id text,
  p_yt_channel_title text,
  p_scopes_granted text[]
)
RETURNS void AS $$
BEGIN
  INSERT INTO google_connections (
    workspace_id, access_token_encrypted, refresh_token_encrypted,
    token_expires_at, google_user_id, google_email,
    yt_channel_id, yt_channel_title, scopes_granted,
    status, last_validated_at
  ) VALUES (
    p_workspace_id,
    pgp_sym_encrypt(p_access_token, p_encryption_key),
    CASE WHEN p_refresh_token IS NOT NULL AND p_refresh_token <> ''
      THEN pgp_sym_encrypt(p_refresh_token, p_encryption_key)
      ELSE NULL END,
    p_token_expires_at,
    NULLIF(p_google_user_id, ''),
    NULLIF(p_google_email, ''),
    p_yt_channel_id,
    NULLIF(p_yt_channel_title, ''),
    COALESCE(p_scopes_granted, '{}'),
    'active', now()
  )
  ON CONFLICT (workspace_id) DO UPDATE SET
    access_token_encrypted = pgp_sym_encrypt(p_access_token, p_encryption_key),
    refresh_token_encrypted = CASE
      WHEN p_refresh_token IS NOT NULL AND p_refresh_token <> ''
        THEN pgp_sym_encrypt(p_refresh_token, p_encryption_key)
      ELSE google_connections.refresh_token_encrypted
    END,
    token_expires_at = p_token_expires_at,
    google_user_id = COALESCE(NULLIF(p_google_user_id, ''), google_connections.google_user_id),
    google_email = COALESCE(NULLIF(p_google_email, ''), google_connections.google_email),
    yt_channel_id = p_yt_channel_id,
    yt_channel_title = COALESCE(NULLIF(p_yt_channel_title, ''), google_connections.yt_channel_title),
    scopes_granted = CASE
      WHEN COALESCE(array_length(p_scopes_granted, 1), 0) > 0 THEN p_scopes_granted
      ELSE google_connections.scopes_granted
    END,
    status = 'active',
    last_validated_at = now(),
    last_error = NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- GET_GOOGLE_ACCESS_TOKEN RPC — decrypts and returns
-- =============================================================
CREATE OR REPLACE FUNCTION get_google_access_token(
  p_workspace_id uuid,
  p_encryption_key text
)
RETURNS text AS $$
DECLARE
  v_encrypted bytea;
BEGIN
  SELECT access_token_encrypted INTO v_encrypted
  FROM google_connections
  WHERE workspace_id = p_workspace_id AND status = 'active';

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(v_encrypted, p_encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================
-- GET_GOOGLE_REFRESH_TOKEN RPC — decrypts and returns
-- =============================================================
CREATE OR REPLACE FUNCTION get_google_refresh_token(
  p_workspace_id uuid,
  p_encryption_key text
)
RETURNS text AS $$
DECLARE
  v_encrypted bytea;
BEGIN
  SELECT refresh_token_encrypted INTO v_encrypted
  FROM google_connections
  WHERE workspace_id = p_workspace_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(v_encrypted, p_encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
