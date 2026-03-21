-- Migration 7: Auth system — profiles, workspace_members, auto-create trigger, save_meta_connection RPC
-- Applied to Supabase via MCP on 2026-03-18

-- =============================================================
-- PROFILES — User extended data with roles
-- =============================================================
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  full_name       text,
  avatar_url      text,
  role            text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active       boolean NOT NULL DEFAULT true,
  last_sign_in_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Service role can insert profiles" ON profiles FOR INSERT WITH CHECK (true);

-- =============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Admin email hardcoded: emendoza@ainnovateagency.com
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'emendoza@ainnovateagency.com' THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- WORKSPACE_MEMBERS — many-to-many user ↔ workspace
-- =============================================================
CREATE TABLE workspace_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by      uuid REFERENCES auth.users(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON workspace_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "members_insert" ON workspace_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "members_delete" ON workspace_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_id = auth.uid())
);

-- =============================================================
-- UPDATE is_workspace_member() to support workspace_members table
-- =============================================================
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspaces WHERE id = ws_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================
-- SAVE_META_CONNECTION RPC — encrypts tokens with pgcrypto
-- =============================================================
CREATE OR REPLACE FUNCTION save_meta_connection(
  p_workspace_id uuid,
  p_access_token text,
  p_encryption_key text,
  p_token_expires_at timestamptz,
  p_fb_user_id text,
  p_page_id text,
  p_page_name text,
  p_page_access_token text,
  p_ig_business_account_id text,
  p_ig_username text,
  p_ad_account_ids text[],
  p_permissions_granted text[]
)
RETURNS void AS $$
BEGIN
  INSERT INTO meta_connections (
    workspace_id, access_token_encrypted, token_expires_at, token_type,
    fb_user_id, page_id, page_name, page_access_token_enc,
    ig_business_account_id, ig_username, ad_account_ids,
    permissions_granted, status, last_validated_at
  ) VALUES (
    p_workspace_id,
    pgp_sym_encrypt(p_access_token, p_encryption_key),
    p_token_expires_at, 'long_lived',
    p_fb_user_id, p_page_id, p_page_name,
    CASE WHEN p_page_access_token IS NOT NULL
      THEN pgp_sym_encrypt(p_page_access_token, p_encryption_key)
      ELSE NULL END,
    p_ig_business_account_id, p_ig_username, p_ad_account_ids,
    p_permissions_granted, 'active', now()
  )
  ON CONFLICT (workspace_id) DO UPDATE SET
    access_token_encrypted = pgp_sym_encrypt(p_access_token, p_encryption_key),
    token_expires_at = p_token_expires_at,
    fb_user_id = p_fb_user_id,
    page_id = p_page_id,
    page_name = p_page_name,
    page_access_token_enc = CASE WHEN p_page_access_token IS NOT NULL
      THEN pgp_sym_encrypt(p_page_access_token, p_encryption_key) ELSE NULL END,
    ig_business_account_id = p_ig_business_account_id,
    ig_username = p_ig_username,
    ad_account_ids = p_ad_account_ids,
    permissions_granted = p_permissions_granted,
    status = 'active',
    last_validated_at = now(),
    last_error = NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
