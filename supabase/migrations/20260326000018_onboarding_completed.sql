-- ============================================================
-- Migration 18: Add onboarding_completed flag to workspaces
-- Used by middleware to block features until ADN is complete.
-- ============================================================

-- 1. Add column
ALTER TABLE public.workspaces
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- 2. Mark admin workspace as completed (admin skips onboarding)
UPDATE public.workspaces
  SET onboarding_completed = true
  WHERE owner_id IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  );
