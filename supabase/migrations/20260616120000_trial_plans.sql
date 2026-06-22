-- ============================================================
-- Migration: Trial plans (30 / 60 / 90 días gratis)
-- El admin elige la duración del trial al crear la invitación.
-- El trial arranca cuando el usuario se registra (handle_new_user).
-- v1: solo visibilidad para el admin en /admin/clients (sin enforcement).
-- ============================================================

-- =============================================================
-- 1. invitations.trial_days — duración elegida por el admin
-- =============================================================
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS trial_days smallint NOT NULL DEFAULT 30
    CHECK (trial_days IN (30, 60, 90));

COMMENT ON COLUMN public.invitations.trial_days IS
  'Días de prueba gratis asignados al usuario al registrarse con esta invitación (30/60/90).';

-- =============================================================
-- 2. workspaces — campos de trial estampados al registrarse
-- =============================================================
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS trial_days       smallint CHECK (trial_days IN (30, 60, 90)),
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamptz;

COMMENT ON COLUMN public.workspaces.trial_days IS
  'Duración del trial en días (copiada de la invitación al registrarse). NULL = sin trial (ej. admin).';
COMMENT ON COLUMN public.workspaces.trial_started_at IS
  'Momento en que arrancó el trial (= alta del usuario via invitación). NULL = sin trial.';
COMMENT ON COLUMN public.workspaces.trial_ends_at IS
  'trial_started_at + trial_days. Fuente del conteo regresivo en /admin/clients. NULL = sin trial.';

-- Índice parcial para futuras queries de vencimiento (enforcement v2).
CREATE INDEX IF NOT EXISTS idx_workspaces_trial_ends_at
  ON public.workspaces(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- =============================================================
-- 3. handle_new_user() — copiar el trial de la invitación al workspace
--    (preserva SECURITY DEFINER + search_path del hardening previo)
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_workspace_id uuid;
  v_user_name text;
  v_slug text;
  v_invitation RECORD;
BEGIN
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
    UPDATE public.invitations
    SET status = 'used', used_by = NEW.id, used_at = now()
    WHERE id = v_invitation.id;

    IF v_invitation.workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
      VALUES (v_invitation.workspace_id, NEW.id, 'member', v_invitation.invited_by);
    END IF;
  END IF;

  -- 3) Create default workspace.
  --    Si vino de una invitación con trial, estampamos el conteo regresivo:
  --    arranca AHORA (alta del usuario) y vence en trial_days días.
  v_slug := lower(regexp_replace(v_user_name, '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);

  INSERT INTO public.workspaces (id, owner_id, name, slug, trial_days, trial_started_at, trial_ends_at)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    v_user_name || '''s Workspace',
    v_slug,
    v_invitation.trial_days,
    CASE WHEN v_invitation.trial_days IS NOT NULL THEN now() END,
    CASE WHEN v_invitation.trial_days IS NOT NULL
         THEN now() + make_interval(days => v_invitation.trial_days::int) END
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$function$;
