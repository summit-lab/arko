-- =============================================================
-- F1.1/F1.2 — Índices de cobertura para foreign keys sin índice
-- =============================================================
-- El advisor de performance de Supabase reportó 11 FKs sin un índice que las
-- cubra (lint unindexed_foreign_keys). Sin índice, los joins por esas columnas
-- y los chequeos de FK en cascada hacen seq scan — degrada a escala (100+ tenants).
--
-- NOTA DE APLICACIÓN: en Dev y Prod estos índices YA se crearon con
-- CREATE INDEX CONCURRENTLY vía execute_sql (no bloquea la tabla; no admite
-- transacción, por eso no se pudo en una migración). Esta migración los versiona
-- con IF NOT EXISTS para que sea idempotente (no-op en Dev/Prod ya aplicados) y
-- se cree solo en ambientes nuevos. En un ambiente nuevo corre dentro de la
-- transacción de migración (CREATE INDEX normal, sin CONCURRENTLY) — ahí la
-- tabla está vacía o chica, así que el lock es irrelevante.
-- Verificado en Prod 2026-06-02: los 11 índices existen y son indisvalid=true.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_user_id ON public.integration_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON public.llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_workspace_id ON public.invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_used_by ON public.invitations(used_by);
CREATE INDEX IF NOT EXISTS idx_workspace_members_invited_by ON public.workspace_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_sales_story_sequence_id ON public.sales(story_sequence_id);
CREATE INDEX IF NOT EXISTS idx_script_comments_user_id ON public.script_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_content_plan_versions_changed_by_user ON public.content_plan_versions(changed_by_user);
CREATE INDEX IF NOT EXISTS idx_content_plan_pending_changes_source_session ON public.content_plan_pending_changes(source_session);
