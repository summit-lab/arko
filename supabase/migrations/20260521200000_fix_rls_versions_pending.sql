-- Fix RLS de content_plan_versions y content_plan_pending_changes:
-- las policies originales solo permitían acceso al owner del workspace.
-- Los miembros (workspace_members) no podían ver historial ni propuestas.
-- Usamos is_workspace_member(ws_id) que cubre owner + miembros invitados.

DROP POLICY IF EXISTS "content_plan_versions_workspace_access" ON content_plan_versions;
CREATE POLICY "content_plan_versions_workspace_access" ON content_plan_versions
  FOR ALL USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "content_plan_pending_changes_workspace_access" ON content_plan_pending_changes;
CREATE POLICY "content_plan_pending_changes_workspace_access" ON content_plan_pending_changes
  FOR ALL USING (is_workspace_member(workspace_id));
