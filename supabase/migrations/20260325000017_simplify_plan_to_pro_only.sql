-- ============================================================
-- Migration 17: Simplify plan to 'pro' only
-- No free or agency plans exist in Arko. All paying users are 'pro'.
-- ============================================================

-- 1. Update any existing workspaces with non-pro plans
UPDATE public.workspaces SET plan = 'pro' WHERE plan != 'pro';

-- 2. Drop the old CHECK constraint and add new one (pro only)
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_plan_check CHECK (plan = 'pro');

-- 3. Ensure default is 'pro'
ALTER TABLE public.workspaces ALTER COLUMN plan SET DEFAULT 'pro';
