-- ============================================================
-- Migration: workspace_goals
-- Description: Monthly goals set by users (views, followers, engagement, etc.)
-- Date: 2026-03-24
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric text NOT NULL,          -- 'views' | 'followers' | 'engagement_rate' | 'likes' | 'saves' | 'reach'
  target_value numeric NOT NULL,
  period_start date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  period_end date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT workspace_goals_unique UNIQUE (workspace_id, metric, period_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspace_goals_workspace_period
  ON public.workspace_goals(workspace_id, period_start);

-- RLS
ALTER TABLE public.workspace_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_goals_select"
  ON public.workspace_goals FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_goals_insert"
  ON public.workspace_goals FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_goals_update"
  ON public.workspace_goals FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_goals_delete"
  ON public.workspace_goals FOR DELETE
  USING (public.is_workspace_member(workspace_id));
