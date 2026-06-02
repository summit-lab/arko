-- =============================================================
-- F1.5 — Optimización RLS: envolver auth.uid() en (select auth.uid())
-- =============================================================
-- El advisor de performance reportó 20 policies (lint auth_rls_initplan) que
-- llamaban auth.uid() SIN envolver → Postgres lo reevalúa POR CADA FILA. A 100+
-- tenants eso degrada toda query con RLS. Fix: envolver en (select auth.uid())
-- para que el planner lo evalúe UNA vez por statement (InitPlan).
--
-- SEMÁNTICA IDÉNTICA: solo cambia auth.uid() → (select auth.uid()); el resto de
-- cada policy (cmd, roles, qual/with_check) se preserva exacto. Acceso sin cambios.
--
-- Aplicado en Dev y Prod vía execute_sql (transacción por tabla). Verificado:
-- auth_rls_initplan bajó de 20 a 0 en ambos. Esta migración lo versiona con
-- DROP POLICY IF EXISTS + CREATE para ser idempotente.
-- Reversible: recrear las policies con auth.uid() sin envolver.
-- =============================================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()));

-- workspaces
DROP POLICY IF EXISTS "Users can view own workspaces" ON public.workspaces;
CREATE POLICY "Users can view own workspaces" ON public.workspaces
  FOR SELECT USING (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
CREATE POLICY "Users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can update own workspaces" ON public.workspaces;
CREATE POLICY "Users can update own workspaces" ON public.workspaces
  FOR UPDATE USING (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users can delete own workspaces" ON public.workspaces;
CREATE POLICY "Users can delete own workspaces" ON public.workspaces
  FOR DELETE USING (owner_id = (select auth.uid()));

-- workspace_members
DROP POLICY IF EXISTS members_select ON public.workspace_members;
CREATE POLICY members_select ON public.workspace_members
  FOR SELECT USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS members_insert ON public.workspace_members;
CREATE POLICY members_insert ON public.workspace_members
  FOR INSERT WITH CHECK (
    (EXISTS ( SELECT 1 FROM workspaces WHERE ((workspaces.id = workspace_members.workspace_id) AND (workspaces.owner_id = (select auth.uid())))))
    OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))))
  );
DROP POLICY IF EXISTS members_delete ON public.workspace_members;
CREATE POLICY members_delete ON public.workspace_members
  FOR DELETE USING (
    EXISTS ( SELECT 1 FROM workspaces WHERE ((workspaces.id = workspace_members.workspace_id) AND (workspaces.owner_id = (select auth.uid()))))
  );

-- llm_usage / integration_usage
DROP POLICY IF EXISTS "Authenticated users can insert own usage" ON public.llm_usage;
CREATE POLICY "Authenticated users can insert own usage" ON public.llm_usage
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can insert own integration_usage" ON public.integration_usage;
CREATE POLICY "Authenticated users can insert own integration_usage" ON public.integration_usage
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- tablas con qual = workspace_id IN (SELECT ... WHERE user_id = auth.uid())
DROP POLICY IF EXISTS workspace_members_stories ON public.ig_stories;
CREATE POLICY workspace_members_stories ON public.ig_stories
  FOR ALL USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_own_stories ON public.ig_story_sequences;
CREATE POLICY workspace_members_own_stories ON public.ig_story_sequences
  FOR ALL USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_own_story_slides ON public.ig_story_slides;
CREATE POLICY workspace_members_own_story_slides ON public.ig_story_slides
  FOR ALL USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_own_sales ON public.sales;
CREATE POLICY workspace_members_own_sales ON public.sales
  FOR ALL USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_own_carousel_slides ON public.carousel_slides;
CREATE POLICY workspace_members_own_carousel_slides ON public.carousel_slides
  FOR ALL USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_read_follower_snapshots ON public.competitor_follower_snapshots;
CREATE POLICY workspace_members_read_follower_snapshots ON public.competitor_follower_snapshots
  FOR SELECT USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_can_manage_content_plan ON public.content_plan;
CREATE POLICY workspace_members_can_manage_content_plan ON public.content_plan
  FOR ALL USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))))
  WITH CHECK (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_read_reel_snapshots ON public.competitor_reel_snapshots;
CREATE POLICY workspace_members_read_reel_snapshots ON public.competitor_reel_snapshots
  FOR SELECT USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS workspace_members_write_reel_snapshots ON public.competitor_reel_snapshots;
CREATE POLICY workspace_members_write_reel_snapshots ON public.competitor_reel_snapshots
  FOR ALL USING (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))))
  WITH CHECK (workspace_id IN ( SELECT workspace_members.workspace_id FROM workspace_members WHERE (workspace_members.user_id = (select auth.uid()))));
