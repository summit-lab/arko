-- =============================================================
-- F1.6 — Consolidar políticas permisivas duplicadas (multiple_permissive_policies)
-- =============================================================
-- El advisor reportó 75 lints (12 tablas) de policies permisivas múltiples para
-- el mismo rol+acción → Postgres evalúa TODAS en cada query. Patrón típico: una
-- policy admin-view solapando una member/owner en SELECT.
--
-- Fusión SEGURA: permisivo OR permisivo = permisivo OR → acceso idéntico. Se unen
-- las N policies SELECT en una sola cuyo USING es el OR de los USING originales.
--
-- Aplicado en Dev y Prod vía execute_sql (transacción por patrón). Verificado:
-- multiple_permissive_policies bajó de 75 a 0 en ambos; acceso preservado.
-- Idempotente: DROP IF EXISTS + CREATE.
-- =============================================================

-- ── Patrón A: admin_select + members_select → una SELECT (is_workspace_member OR is_admin)
-- meta_connections
DROP POLICY IF EXISTS "Admin can view all meta_connections" ON public.meta_connections;
DROP POLICY IF EXISTS meta_connections_select ON public.meta_connections;
CREATE POLICY meta_connections_select ON public.meta_connections
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());
-- workspace_brand
DROP POLICY IF EXISTS admin_select_workspace_brand ON public.workspace_brand;
DROP POLICY IF EXISTS members_select_workspace_brand ON public.workspace_brand;
CREATE POLICY members_select_workspace_brand ON public.workspace_brand
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());
-- workspace_competitors
DROP POLICY IF EXISTS admin_select_workspace_competitors ON public.workspace_competitors;
DROP POLICY IF EXISTS members_select_workspace_competitors ON public.workspace_competitors;
CREATE POLICY members_select_workspace_competitors ON public.workspace_competitors
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());
-- workspace_market
DROP POLICY IF EXISTS admin_select_workspace_market ON public.workspace_market;
DROP POLICY IF EXISTS members_select_workspace_market ON public.workspace_market;
CREATE POLICY members_select_workspace_market ON public.workspace_market
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());
-- workspace_profile
DROP POLICY IF EXISTS admin_select_workspace_profile ON public.workspace_profile;
DROP POLICY IF EXISTS members_select_workspace_profile ON public.workspace_profile;
CREATE POLICY members_select_workspace_profile ON public.workspace_profile
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());
-- workspace_references
DROP POLICY IF EXISTS admin_select_workspace_references ON public.workspace_references;
DROP POLICY IF EXISTS members_select_workspace_references ON public.workspace_references;
CREATE POLICY members_select_workspace_references ON public.workspace_references
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());
-- workspace_strategies
DROP POLICY IF EXISTS admin_select_workspace_strategies ON public.workspace_strategies;
DROP POLICY IF EXISTS members_select_workspace_strategies ON public.workspace_strategies;
CREATE POLICY members_select_workspace_strategies ON public.workspace_strategies
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());

-- ── Patrón B: admin + owner-by-auth → una SELECT
-- profiles
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((id = (select auth.uid())) OR is_admin());
-- workspaces
DROP POLICY IF EXISTS "Admin can view all workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view own workspaces" ON public.workspaces;
CREATE POLICY "Users can view own workspaces" ON public.workspaces
  FOR SELECT USING ((owner_id = (select auth.uid())) OR is_admin());

-- ── Patrón C: la policy ALL (write) ya cubre SELECT → drop la SELECT read redundante
DROP POLICY IF EXISTS workspace_members_read_follower_snapshots ON public.competitor_follower_snapshots;
DROP POLICY IF EXISTS workspace_members_read_reel_snapshots ON public.competitor_reel_snapshots;

-- ── Patrón D: google_connections — la policy ALL solapa las 4 por-acción → drop la ALL
-- (las 4 por-acción google_conn_{select,insert,update,delete} ya cubren todo;
--  select mantiene OR is_admin)
DROP POLICY IF EXISTS workspace_members_own_google_connections ON public.google_connections;
