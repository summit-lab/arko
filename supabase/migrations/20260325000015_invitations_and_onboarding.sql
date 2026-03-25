-- ============================================================
-- Migration 15: Invitations + Onboarding Schema
-- Adds invitation-only registration system and onboarding
-- questionnaire tables for workspace context.
-- ============================================================

-- =============================================================
-- 1. INVITATIONS TABLE
-- =============================================================
CREATE TABLE invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  token       uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  invited_by  uuid NOT NULL REFERENCES profiles(id),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  used_by     uuid REFERENCES auth.users(id),
  used_at     timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_status ON invitations(status);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "admin_select_invitations" ON invitations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_insert_invitations" ON invitations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_update_invitations" ON invitations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================================
-- 2. RPC: validate_invitation (SECURITY DEFINER for anon access)
-- =============================================================
CREATE OR REPLACE FUNCTION validate_invitation(p_token uuid)
RETURNS TABLE(valid boolean, email text, invitation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT true, i.email, i.id
  FROM invitations i
  WHERE i.token = p_token
    AND i.status = 'pending'
    AND i.expires_at > now()
  LIMIT 1;
END;
$$;

-- =============================================================
-- 3. UPDATE handle_new_user() — add invitation lookup
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id uuid;
  v_user_name text;
  v_slug text;
  v_invitation RECORD;
BEGIN
  -- Derive display name
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- 1) Create profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_user_name,
    CASE WHEN NEW.email = 'emendoza@ainnovateagency.com' THEN 'admin' ELSE 'user' END
  );

  -- 2) Check for pending invitation
  SELECT * INTO v_invitation FROM public.invitations
  WHERE email = NEW.email AND status = 'pending' AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_invitation.id IS NOT NULL THEN
    -- Mark invitation as used
    UPDATE public.invitations
    SET status = 'used', used_by = NEW.id, used_at = now()
    WHERE id = v_invitation.id;

    -- If invitation has workspace_id, add user to that workspace
    IF v_invitation.workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
      VALUES (v_invitation.workspace_id, NEW.id, 'member', v_invitation.invited_by);
    END IF;
  END IF;

  -- 3) Create default workspace (always, so user has their own)
  v_slug := lower(regexp_replace(v_user_name, '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);

  INSERT INTO public.workspaces (id, owner_id, name, slug)
  VALUES (gen_random_uuid(), NEW.id, v_user_name || '''s Workspace', v_slug)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- 4. ONBOARDING TABLES (schema only, UI in Phase 2)
-- =============================================================

-- workspace_profile: business identity & brand context
CREATE TABLE workspace_profile (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  business_description text,
  brand_persona       text,
  avatar_description  text,
  main_offer          text,
  target_audience     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_workspace_profile_updated_at
  BEFORE UPDATE ON workspace_profile
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE workspace_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_workspace_profile" ON workspace_profile
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_workspace_profile" ON workspace_profile
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_workspace_profile" ON workspace_profile
  FOR UPDATE USING (is_workspace_member(workspace_id));

-- workspace_strategies: per-platform content strategy
CREATE TABLE workspace_strategies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform          text NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'other')),
  what_tested       text,
  test_results      text,
  conclusions       text,
  current_strategy  text,
  formats_and_quantity text,
  why_it_will_work  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform)
);

CREATE TRIGGER set_workspace_strategies_updated_at
  BEFORE UPDATE ON workspace_strategies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE workspace_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_workspace_strategies" ON workspace_strategies
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_workspace_strategies" ON workspace_strategies
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_workspace_strategies" ON workspace_strategies
  FOR UPDATE USING (is_workspace_member(workspace_id));

-- workspace_competitors: competitor analysis
CREATE TABLE workspace_competitors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            text,
  ig_url          text,
  why_better      text,
  scraped_data    jsonb DEFAULT '{}',
  last_scraped_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_competitors_ws ON workspace_competitors(workspace_id);

ALTER TABLE workspace_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_workspace_competitors" ON workspace_competitors
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_workspace_competitors" ON workspace_competitors
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_workspace_competitors" ON workspace_competitors
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "members_delete_workspace_competitors" ON workspace_competitors
  FOR DELETE USING (is_workspace_member(workspace_id));

-- workspace_market: industry context & trends
CREATE TABLE workspace_market (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  industry_state    text,
  audience_exposure text,
  market_beliefs    text,
  burned_topics     text,
  current_trends    text,
  competitiveness   text,
  differentiator    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_workspace_market_updated_at
  BEFORE UPDATE ON workspace_market
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE workspace_market ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_workspace_market" ON workspace_market
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_workspace_market" ON workspace_market
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_workspace_market" ON workspace_market
  FOR UPDATE USING (is_workspace_member(workspace_id));

-- workspace_references: aspirational brands
CREATE TABLE workspace_references (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_name      text,
  brand_url       text,
  what_they_like  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_references_ws ON workspace_references(workspace_id);

ALTER TABLE workspace_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_workspace_references" ON workspace_references
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_workspace_references" ON workspace_references
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_workspace_references" ON workspace_references
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "members_delete_workspace_references" ON workspace_references
  FOR DELETE USING (is_workspace_member(workspace_id));

-- workspace_brand: brand differentiation & language
CREATE TABLE workspace_brand (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  why_clients_choose  text,
  niche_language      text,
  niche_tools         text,
  filtering_words     text,
  new_mechanisms      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_workspace_brand_updated_at
  BEFORE UPDATE ON workspace_brand
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE workspace_brand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_workspace_brand" ON workspace_brand
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "members_insert_workspace_brand" ON workspace_brand
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "members_update_workspace_brand" ON workspace_brand
  FOR UPDATE USING (is_workspace_member(workspace_id));
