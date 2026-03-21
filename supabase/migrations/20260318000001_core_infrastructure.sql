-- Migration 1: Core infrastructure
-- Creates: pgcrypto extension, handle_updated_at function, workspaces table

-- Enable pgcrypto for token encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Utility function: auto-update updated_at on UPDATE
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- WORKSPACES — Multi-tenant root entity
-- Each workspace = one brand/creator account
-- =============================================================
CREATE TABLE workspaces (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  plan            text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency')),
  reels_limit     int NOT NULL DEFAULT 10,
  is_active       boolean NOT NULL DEFAULT true,
  settings        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON workspaces(slug);

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
