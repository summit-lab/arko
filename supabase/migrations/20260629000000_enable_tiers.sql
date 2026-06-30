-- ============================================================
-- Migration: 3-tier system (demo / standard / pro)
-- Libera el CHECK de workspaces.plan (clavado a 'pro'), agrega el carrier
-- invitations.plan, hace que handle_new_user asigne el tier al registrarse,
-- cierra la escalación de privilegios (owner UPDATE sin WITH CHECK) y permite
-- al admin asignar tier post-signup.
--
-- Reconciliada contra el estado REAL de Prod Arko (zphvrohosizkbrnxtppj):
--   - trial_plans YA aplicada (workspaces.trial_*, invitations.trial_days NOT NULL DEFAULT 30)
--   - handle_new_user() = versión trial-aware (preservada tal cual + lógica de tier)
--   - is_admin() SECURITY DEFINER existe
--   - 23 workspaces, todos plan='pro' -> quedan PRO (acceso total), intactos
-- Aditiva y reversible. Ver rollback al pie.
-- ============================================================

-- 0) Paranoia: normalizar cualquier valor fuera de dominio antes del nuevo CHECK
UPDATE public.workspaces SET plan = 'pro' WHERE plan NOT IN ('demo','standard','pro');

-- 1) Liberar el CHECK clavado a 'pro' (de 20260325000017)
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_plan_check
  CHECK (plan IN ('demo','standard','pro'));

-- DEFAULT fail-closed: un workspace sin plan explícito no puede gastar.
ALTER TABLE public.workspaces ALTER COLUMN plan SET DEFAULT 'demo';

COMMENT ON CONSTRAINT workspaces_plan_check ON public.workspaces IS
  'Tiers: demo (lead-magnet permanente), standard (trial), pro (paga). Asignación manual por admin.';

-- 2) invitations.plan — tier explícito que el admin elige al invitar (nullable)
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS plan text
    CHECK (plan IN ('demo','standard','pro')) DEFAULT NULL;
COMMENT ON COLUMN public.invitations.plan IS
  'Tier explícito asignado por el admin al invitar. NULL = derivar (con invitación -> standard; sin invitación -> demo).';

-- 3) handle_new_user() — versión de Prod + asignación de tier.
--    admin -> pro; invitation.plan explícito gana (COALESCE);
--    invitación sin plan -> standard (trial); sin invitación -> demo.
--    Los campos trial_* SOLO se estampan si el tier final es 'standard'.
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
  v_plan text;
  v_is_trial boolean;
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

  -- 3) Resolver el tier
  v_plan := CASE
    WHEN NEW.email = 'emendoza@ainnovateagency.com' THEN 'pro'
    ELSE COALESCE(
      v_invitation.plan,
      CASE WHEN v_invitation.id IS NOT NULL THEN 'standard' ELSE 'demo' END)
  END;
  v_is_trial := (v_plan = 'standard');  -- demo permanente; pro sin trial

  -- 4) Create default workspace (con tier; trial solo si standard)
  v_slug := lower(regexp_replace(v_user_name, '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);

  INSERT INTO public.workspaces (id, owner_id, name, slug, plan, trial_days, trial_started_at, trial_ends_at)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    v_user_name || '''s Workspace',
    v_slug,
    v_plan,
    CASE WHEN v_is_trial THEN v_invitation.trial_days END,
    CASE WHEN v_is_trial THEN now() END,
    CASE WHEN v_is_trial THEN now() + make_interval(days => v_invitation.trial_days::int) END
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$function$;

-- 4) SEGURIDAD (no diferible): impedir que un NO-admin escale su propio plan/trial
--    vía el client (la policy de owner UPDATE tiene WITH CHECK NULL).
CREATE OR REPLACE FUNCTION public.prevent_plan_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.trial_days IS DISTINCT FROM OLD.trial_days
      OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
      OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at)
     AND NOT public.is_admin()
  THEN
    NEW.plan := OLD.plan;
    NEW.trial_days := OLD.trial_days;
    NEW.trial_started_at := OLD.trial_started_at;
    NEW.trial_ends_at := OLD.trial_ends_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_plan_self_escalation ON public.workspaces;
CREATE TRIGGER trg_prevent_plan_self_escalation
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.prevent_plan_self_escalation();

-- 5) RLS: el admin puede UPDATE cualquier workspace (asignar plan post-signup).
DROP POLICY IF EXISTS "admin_update_workspaces" ON public.workspaces;
CREATE POLICY "admin_update_workspaces" ON public.workspaces
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- ROLLBACK (reversible):
--   DROP TRIGGER IF EXISTS trg_prevent_plan_self_escalation ON public.workspaces;
--   DROP FUNCTION IF EXISTS public.prevent_plan_self_escalation();
--   DROP POLICY IF EXISTS "admin_update_workspaces" ON public.workspaces;
--   ALTER TABLE public.invitations DROP COLUMN IF EXISTS plan;
--   ALTER TABLE public.workspaces DROP CONSTRAINT workspaces_plan_check;
--   ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_plan_check CHECK (plan = 'pro');
--   ALTER TABLE public.workspaces ALTER COLUMN plan SET DEFAULT 'pro';
--   UPDATE public.workspaces SET plan='pro' WHERE plan <> 'pro';
--   -- + restaurar handle_new_user() a la versión trial-aware (sin lógica de tier)
-- ============================================================
