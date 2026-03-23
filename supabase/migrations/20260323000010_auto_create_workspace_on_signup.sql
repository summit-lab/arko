-- Migration 10: Auto-create workspace + workspace_member on user signup
-- Fixes: handle_new_user() only created profile, not workspace.
-- This caused "workspace_id is required" error on Instagram connect.
-- Applied to Supabase via MCP on 2026-03-23

-- =============================================================
-- 1. UPDATE handle_new_user() — now creates profile + workspace + workspace_member
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id uuid;
  v_user_name text;
  v_slug text;
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

  -- 2) Create default workspace
  -- Slug = sanitized name + random suffix to guarantee uniqueness
  v_slug := lower(regexp_replace(v_user_name, '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);

  INSERT INTO public.workspaces (id, owner_id, name, slug)
  VALUES (gen_random_uuid(), NEW.id, v_user_name || '''s Workspace', v_slug)
  RETURNING id INTO v_workspace_id;

  -- 3) Add user as owner in workspace_members
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger on_auth_user_created already exists from migration 7,
-- pointing to handle_new_user(). No need to recreate it —
-- replacing the function body is enough.

-- =============================================================
-- 2. BACKFILL — Create workspaces for existing users who don't have one
-- =============================================================
DO $$
DECLARE
  r RECORD;
  v_workspace_id uuid;
  v_user_name text;
  v_slug text;
BEGIN
  FOR r IN
    SELECT p.id, p.email, p.full_name
    FROM profiles p
    LEFT JOIN workspaces w ON w.owner_id = p.id
    WHERE w.id IS NULL
  LOOP
    v_user_name := COALESCE(r.full_name, split_part(r.email, '@', 1));
    v_slug := lower(regexp_replace(v_user_name, '[^a-z0-9]+', '-', 'gi'));
    v_slug := trim(both '-' from v_slug);
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);

    INSERT INTO public.workspaces (id, owner_id, name, slug)
    VALUES (gen_random_uuid(), r.id, v_user_name || '''s Workspace', v_slug)
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, r.id, 'owner');

    RAISE NOTICE 'Created workspace % for user %', v_workspace_id, r.email;
  END LOOP;
END;
$$;
