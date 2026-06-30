<!-- Estado: FASE 1 IMPLEMENTADA Y VERIFICADA (2 rondas de verificación adversarial multi-agente) — 2026-06-30. Migración aplicada a Prod (zphvrohosizkbrnxtppj); tsc + lint limpios. Demo hermético: ~26 rutas de gasto gateadas server-side (403 antes de LLM/Apify) + páginas/Sidebar con trap pop-up FeatureLock + Demo saltea el ADN. Pendiente Fase 2: budget-guard $/día (0.15 demo / 0.50 standard-pro), límites por tier (3/5 competidores, 20/100 reels), picker de tier post-signup en admin. Plan original generado por workflow ultracode moka-tiers-plan. -->

# PLAN DE IMPLEMENTACIÓN — Sistema 3-Tier Moka (DEMO / STANDARD / PRO)

> Documento ejecutable. Mantiene la lógica mínima y limpia. Todo lo **DIFERIBLE** está marcado como `[FASE 2]` o `[DIFERIBLE]`. Prioridad absoluta: **shippear DEMO esta semana** (funnel arranca a mitad de semana del 2026-06-29).

> **✅ Confirmado 2026-06-29:** **S1** → YouTube y Meta Ads también OFF en Demo. **S2** → cap solo en Reels (=12); Historias/Posts quedan full. **S4** → budget-guard diferido a Fase 2. **S6** → zona horaria **America/Argentina/Buenos_Aires** (corrige el `'utc'` del §4, que es Fase 2). **S8** → verificar `is_admin()` en Dev Arko antes de migrar.

---

## 0. Nomenclatura — tier técnico ↔ etiqueta de UI

Cada etapa del funnel es **un solo tier** (relación 1:1). El valor canónico vive en `workspaces.plan` y lo usa todo el código; la **etiqueta** es solo lo que se muestra en el admin/UI. **No se ven los dos a la vez:** en la app solo aparece la etiqueta.

| Etapa del funnel | Etiqueta (lo que se ve en la app) | Valor en DB (`workspaces.plan`) | Trial |
|---|---|---|---|
| Lead (funnel gratis) | **Demo** | `demo` | — (permanente) |
| Prueba gratis | **Free Trial** | `standard` | sí (30/60/90; al vencer → `demo`) |
| Pago | **Full** | `pro` | — (permanente) |

**Por qué `standard`/`pro` difieren de su etiqueta:** la DB ya tenía `pro` clavado (23 workspaces + mucho código lo usan), así que renombrarlo a `full` sería churn sin beneficio. Se mantiene el valor canónico y se relabela en la UI. `demo` no diverge (misma palabra en ambos).

El mapeo vive en `TIER_LABEL` en `src/lib/tier/config.ts` (fuente única de las etiquetas). Si en el futuro se quiere unificar a un solo nombre: o se muestran los técnicos en el admin (cero trabajo), o se renombran los valores en la DB (migración).

---

## 1. Resumen + SUPUESTOS A CONFIRMAR

**Qué construimos.** Un sistema de 3 tiers asignados 100% manualmente por el admin (cero pagos por Moka, cero Stripe). El tier es **derivado, nunca almacenado como runtime-state**: una función pura `resolveTier(plan, trial_ends_at)` es la única verdad, y el auto-downgrade de trial vencido es esa función evaluada lazy (cero cron, cero trigger de expiración). El server (`authenticateRequest` → `requireFeature`) es el único guardián del dinero; la UI es cosmética y puede estar stale sin riesgo. Un objeto `TIER_CONFIG` en código es el único lugar con números (cumple el SPEC: nada de tabla de config en DB).

**Arquitectura en una línea:** 0 tablas nuevas · 1 columna nueva (`invitations.plan`) · 0 cookies nuevas · 3 archivos nuevos en Fase 1 · auto-downgrade sin infraestructura.

### SUPUESTOS A CONFIRMAR (bloquean el arranque si están mal)

| # | Supuesto (default que asumo) | Por qué importa | Confirmar |
|---|---|---|---|
| S1 | **DEMO visible:** Dashboard + Reels propios + Historias propias. **OFF:** Espía/Competencia, Tu Audiencia, Ventas, Mesa de Trabajo, Moka AI, YouTube, Meta Ads, análisis de reels con IA. | Define qué `features` van en `ALL_OFF`. | ¿YouTube y Ads también OFF en Demo? (asumo **sí**). |
| S2 | **Cap de reels propios en Demo = 12** (display only; sync Meta es gratis). Historias y posts: capear opcional a 12. | `ownReelsCap`. | ¿Capear también historias/posts a 12, o dejarlas full? (asumo **reels=12, historias/posts full** para no romper el dashboard). |
| S3 | **Análisis IA + Moka AI = totalmente OFF en Demo** (403 server-side antes de tocar LLM/Apify). | Hermeticidad de gasto. | OK por SPEC. |
| S4 | **Red de seguridad de gasto Demo ≈ 0.15 USD/día** es `[FASE 2]` y casi irrelevante (las features caras devuelven 403 antes de medir). En Fase 1 Demo gasta **0** porque todo lo caro está bloqueado en la puerta. | Evita over-engineering en el ship urgente. | ¿OK diferir el budget-guard a Fase 2? (asumo **sí**). |
| S5 | **Valores canónicos de `plan`:** `'demo'` (lead-magnet permanente, sin trial), `'standard'` (trial 30/60/90), `'pro'` (paga, sin trial). | CHECK + trigger + `resolveTier`. | OK por SPEC. |
| S6 | **Zona horaria del “día” del cap diario = UTC** (`date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'`), índice-friendly. | Cálculo del gasto diario `[FASE 2]`. | ¿UTC o America/Argentina/Buenos_Aires? (asumo **UTC**; es el default de Supabase y usa el índice por `created_at`). |
| S7 | **Caps Standard/Pro:** Standard = 0.50 USD/día, 3 competidores, 20 reels. Pro = **0.50 USD/día**, 5 competidores, 100 reels. (El SPEC manda 0.50 para Pro, NO los 5.00 del research budget-guard). | `TIER_CONFIG`. | OK por SPEC. |
| S8 | **`is_admin()` SECURITY DEFINER existe** (citado en mig `20260325000016`). Si no, usar subquery inline `EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin')`. | RLS + trigger anti-escalación. | **Verificar con `\df is_admin` antes de la migración.** |

---

## 2. Data model & migraciones (Dev Arko `hrsvglgswatwklivkoyp`, DB-first, reversibles)

> **INVIOLABLE:** la IA SOLO aplica migraciones en Dev Arko. Nunca Prod en desarrollo. DB primero, código después.

### Migración Fase 1 — `supabase/migrations/20260629000000_enable_tiers.sql`

```sql
-- ============================================================
-- 3-tier: liberar CHECK de plan + carrier invitations.plan
-- + asignación de tier en handle_new_user + anti-escalación + RLS admin.
-- Reversible. Backfill: filas existentes ya están en 'pro' (mig 17) → intactas.
-- ============================================================

-- 0) Paranoia: normalizar cualquier valor fuera de dominio antes del CHECK
UPDATE public.workspaces SET plan = 'pro' WHERE plan NOT IN ('demo','standard','pro');

-- 1) Liberar el CHECK clavado a 'pro' (de 20260325000017, línea 11)
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_plan_check
  CHECK (plan IN ('demo','standard','pro'));

-- DEFAULT fail-closed: un workspace sin plan explícito no puede gastar.
ALTER TABLE public.workspaces ALTER COLUMN plan SET DEFAULT 'demo';

COMMENT ON CONSTRAINT workspaces_plan_check ON public.workspaces IS
  'Tiers: demo (lead-magnet permanente), standard (trial), pro (paga). Asignación manual por admin.';

-- 2) invitations.plan — carrier explícito del tier que el admin elige al invitar (nullable)
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS plan text
    CHECK (plan IN ('demo','standard','pro')) DEFAULT NULL;
COMMENT ON COLUMN public.invitations.plan IS
  'Tier explícito asignado por el admin al invitar. NULL = derivar (con trial → standard; sin invitación → demo).';

-- 3) Recrear handle_new_user() con asignación de tier.
--    Regla: admin → pro; plan explícito de la invitación gana (COALESCE);
--    invitación sin plan → standard (tiene trial); sin invitación → demo.
--    trial_* SOLO si el tier final es 'standard'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
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
  v_user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, v_user_name,
    CASE WHEN NEW.email = 'emendoza@ainnovateagency.com' THEN 'admin' ELSE 'user' END);

  SELECT * INTO v_invitation FROM public.invitations
  WHERE email = NEW.email AND status = 'pending' AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF v_invitation.id IS NOT NULL THEN
    UPDATE public.invitations SET status='used', used_by=NEW.id, used_at=now()
      WHERE id = v_invitation.id;
    IF v_invitation.workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
      VALUES (v_invitation.workspace_id, NEW.id, 'member', v_invitation.invited_by);
    END IF;
  END IF;

  v_plan := CASE
    WHEN NEW.email = 'emendoza@ainnovateagency.com' THEN 'pro'
    ELSE COALESCE(
      v_invitation.plan,
      CASE WHEN v_invitation.id IS NOT NULL THEN 'standard' ELSE 'demo' END)
  END;
  v_is_trial := (v_plan = 'standard');  -- demo permanente; pro sin trial

  v_slug := trim(both '-' from lower(regexp_replace(v_user_name, '[^a-z0-9]+', '-', 'gi')));
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);

  INSERT INTO public.workspaces (id, owner_id, name, slug, plan, trial_days, trial_started_at, trial_ends_at)
  VALUES (
    gen_random_uuid(), NEW.id, v_user_name || '''s Workspace', v_slug,
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

-- 4) SEGURIDAD (Fase 1, NO diferible): impedir que un NO-admin escale su propio
--    plan/trial via el client (la policy de owner UPDATE no tiene WITH CHECK).
CREATE OR REPLACE FUNCTION public.prevent_plan_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.trial_days IS DISTINCT FROM OLD.trial_days
      OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
      OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at)
     AND NOT public.is_admin()        -- ⚠ si is_admin() no existe: EXISTS(...) inline
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
--    No interfiere con la policy de owner (owner_id = auth.uid()).
CREATE POLICY "admin_update_workspaces" ON public.workspaces
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
```

**Backfill.** Las filas existentes ya están en `'pro'` por mig 17 → quedan PRO con acceso total; no se tocan (paso 0 es solo paranoia anti-corrupción). **Admin:** su workspace queda `'pro'`, así que **no hace falta lógica de admin en los gates** (razonan solo sobre el plan del workspace). **Índices:** ninguno nuevo en Fase 1 (`idx_workspaces_trial_ends_at` ya existe). Los índices de gasto van en `[FASE 2]` (§4).

**Rollback (100% reversible):**
```sql
DROP TRIGGER IF EXISTS trg_prevent_plan_self_escalation ON public.workspaces;
DROP FUNCTION IF EXISTS public.prevent_plan_self_escalation();
DROP POLICY IF EXISTS "admin_update_workspaces" ON public.workspaces;
ALTER TABLE public.invitations DROP COLUMN IF EXISTS plan;
ALTER TABLE public.workspaces DROP CONSTRAINT workspaces_plan_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_plan_check CHECK (plan = 'pro');
ALTER TABLE public.workspaces ALTER COLUMN plan SET DEFAULT 'pro';
UPDATE public.workspaces SET plan='pro' WHERE plan <> 'pro';
-- + restaurar handle_new_user() anterior (sin lógica de tier)
```

### Tipos — `src/types/database.ts`
- **Línea 9:** `export type WorkspacePlan = 'demo' | 'standard' | 'pro';`
- **`interface Workspace` (tras `updated_at`, falta hoy y el código ya lo lee en `layout.tsx`):** agregar `onboarding_completed: boolean;`

---

## 3. Config central de entitlements — `src/lib/tier/config.ts` (NUEVO, Fase 1)

Pura, sin I/O, sin React. **Único lugar con números.** La consume: `auth.ts` (`resolveTier`), `guard.ts` (`hasFeature`), `layout.tsx`+`Sidebar` (UI), `instagram/page.tsx` (`ownReelsCap`), y en `[FASE 2]` el budget-guard (`dailyBudget`) y los clamps.

```ts
export type Tier = 'demo' | 'standard' | 'pro';

export type Feature =
  | 'competitors' | 'audience' | 'sales' | 'worktable' | 'mokaAI'
  | 'youtube' | 'ads' | 'reelAiAnalysis';

export interface TierConfig {
  dailyBudgetUsd: number;     // cap diario = llm_usage + integration_usage  [FASE 2]
  maxCompetitors: number;     // [FASE 2]
  maxReelsPerScrape: number;  // [FASE 2]
  maxBulkAnalyze: number;     // [FASE 2]
  ownReelsCap: number;        // FASE 1: tope display de reels propios
  features: Record<Feature, boolean>;
}

const ALL_ON:  Record<Feature, boolean> = { competitors:true,  audience:true,  sales:true,  worktable:true,  mokaAI:true,  youtube:true,  ads:true,  reelAiAnalysis:true  };
const ALL_OFF: Record<Feature, boolean> = { competitors:false, audience:false, sales:false, worktable:false, mokaAI:false, youtube:false, ads:false, reelAiAnalysis:false };

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  demo:     { dailyBudgetUsd:0.15, maxCompetitors:0, maxReelsPerScrape:0,   maxBulkAnalyze:0, ownReelsCap:12,  features:ALL_OFF },
  standard: { dailyBudgetUsd:0.50, maxCompetitors:3, maxReelsPerScrape:20,  maxBulkAnalyze:3, ownReelsCap:200, features:ALL_ON  },
  pro:      { dailyBudgetUsd:0.50, maxCompetitors:5, maxReelsPerScrape:100, maxBulkAnalyze:5, ownReelsCap:200, features:ALL_ON  },
};

export const cfg            = (t: Tier) => TIER_CONFIG[t];
export const hasFeature     = (t: Tier, f: Feature) => TIER_CONFIG[t].features[f];
export const dailyBudget    = (t: Tier) => TIER_CONFIG[t].dailyBudgetUsd;          // [FASE 2]
export const clampReels       = (t: Tier, n: number) => Math.min(n, TIER_CONFIG[t].maxReelsPerScrape);   // [FASE 2]
export const clampCompetitors = (t: Tier, n: number) => Math.min(n, TIER_CONFIG[t].maxCompetitors);      // [FASE 2]

// AUTO-DOWNGRADE LAZY: standard vencido → demo, sin tocar la DB.
export function resolveTier(plan: string | null, trialEndsAt: string | null): Tier {
  if (plan === 'pro')  return 'pro';
  if (plan === 'demo') return 'demo';
  if (plan === 'standard')
    return (trialEndsAt && new Date(trialEndsAt) < new Date()) ? 'demo' : 'standard';
  return 'demo'; // fail-closed
}

// Texto EXACTO del SPEC para la trampa Demo
export const TRAP = {
  title: 'Este plan no está disponible.',
  description: 'Comunicate con nuestro equipo para acceder a un plan premium con todas las funciones.',
  ctaText: 'Volver al dashboard',
  ctaHref: '/',
} as const;

// Mapa nav.href → Feature (lo consumen Sidebar y el gating de páginas)
export const ROUTE_FEATURE: Partial<Record<string, Feature>> = {
  '/instagram?tab=competencia': 'competitors',
  '/instagram?tab=metrics':     'audience',
  '/ventas':                    'sales',
  '/mesa-de-trabajo':           'worktable',
  '/agents':                    'mokaAI',
  '/youtube':                   'youtube',
  '/ads':                       'ads',
};
```

> **Nota de simplicidad:** los campos `dailyBudgetUsd / maxCompetitors / maxReelsPerScrape / maxBulkAnalyze` y los getters `dailyBudget / clampReels / clampCompetitors` están en el objeto pero **solo se consumen en `[FASE 2]`**. Se incluyen ahora para que el objeto sea la fuente única desde el día 1; no agregan superficie ejecutada en Fase 1.

---

## 4. Guardia de presupuesto diario `[FASE 2]`

> Diferible. En Fase 1 Demo gasta 0 (todo lo caro devuelve 403 en la puerta). Esto protege de verdad a **standard/pro en 0.50 USD/día**.

### 4a. SQL — `supabase/migrations/2026XXXX_daily_spend.sql`
Función `STABLE`, una pasada, día UTC (índice-friendly) + **índices compuestos** (fix edge-case #3 de presupuesto):
```sql
CREATE INDEX IF NOT EXISTS idx_llm_usage_daily         ON public.llm_usage(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_usage_daily ON public.integration_usage(workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_daily_spend_usd(p_workspace_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(cost_usd),0)::numeric FROM (
    SELECT cost_usd FROM llm_usage
      WHERE workspace_id = p_workspace_id
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
    UNION ALL
    SELECT cost_usd FROM integration_usage
      WHERE workspace_id = p_workspace_id
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
  ) s;
$$;
```
**Timezone (S6):** día UTC midnight→now; `created_at >= timestamptz_medianoche` **usa el índice** (mejor que `created_at::date = CURRENT_DATE`).

### 4b. Helper — `src/lib/tier/budget-guard.ts` (NUEVO) + `api429` en `response.ts`
Firmas:
```ts
export function estimateCost(op: 'reel-scrape'|'competitor-reel-scrape'|'competitor-profile'|'gemini-video'|'chat-tool-loop', items?: number): number;
export async function getDailySpend(sb: SupabaseClient, ws: string): Promise<number>;        // rpc get_daily_spend_usd
export async function requireBudget(sb: SupabaseClient, ws: string, tier: Tier, estimatedUsd: number): Promise<Response | null>; // null=OK; Response 429=sin budget
```
**Pre-estimate Apify (pricing conocido):** `competitor-profile`=0.01 · `reel-scrape`=0.0033×items · `competitor-reel-scrape`=0.0039×items · `gemini-video`=0.01×items · `chat-tool-loop`=0.50 (5 iter worst-case, presupuestar 2× por retries).

### 4c. Puntos de llamada EXACTOS (las 9 rutas caras). Patrón: `requireFeature` → `requireBudget` **antes** de gastar; el `logLLMUsage`/`logIntegrationUsage` existente avanza el contador **después**.

| Ruta | feature | `estimateCost(...)` |
|---|---|---|
| `chat/route.ts` | mokaAI | `'chat-tool-loop'` (0.50) — emitido como SSE `error` + `controller.close()` antes de abrir stream |
| `competitors/[id]/scrape` | competitors | `0.01 + estimateCost('competitor-reel-scrape', reels)` |
| `competitors/[id]/analyze` | competitors | `estimateCost('gemini-video', maxBulkAnalyze)` |
| `reels/[id]/gemini-analyze` | reelAiAnalysis | `estimateCost('gemini-video', 1)` |
| `references/[id]/analyze-all` | audience | `estimateCost('gemini-video', 5)` |
| `references/[id]/reels/[sc]/analyze` | audience | `estimateCost('gemini-video', 1)` |
| `reels/enrich-durations` | (solo budget) | `estimateCost('reel-scrape', MAX_REELS)` — **silent fail** no-bloqueante |
| `onboarding/chat` | (solo budget) | 0.10 |

**Overshoot (edge-case #1/#4):** el pre-check es un estimate; dos requests concurrentes pueden pasar ambos → **se acepta overshoot acotado (~1.2–2×)**; el cap es un target, no una transacción atómica. El log post-hoc registra el sobrepaso, **no bloquea** (ya se gastó). **UX de error:** HTTP 429 con `{message:"Alcanzaste tu límite diario de gasto (${cap} USD). Reintentá mañana.", spent, cap}`; en chat SSE → evento `{type:'error', message:…}`. **Sin tabla de auditoría en v1.**

---

## 5. Capa de gating

> **DECISIÓN DE DISEÑO (anula la sugerencia de “cookie de tier en middleware”):** **NO se usa cookie de tier.** Tanto `layout.tsx` como `instagram/page.tsx` **ya** fetchean el workspace en cada render, y `authenticateRequest` **ya** hace un SELECT a `workspaces`; el tier se deriva gratis y **siempre fresco**. Una cookie solo agregaría un punto de invalidación roto: cuando el admin cambia el plan de **otro** usuario, no puede limpiar la cookie de ese usuario → tier stale. Eliminarla quita una pieza entera de infraestructura y su modo de fallo. `[DIFERIBLE/RECHAZADO]` — si en el futuro el SELECT del layout se volviera caro, recién ahí se evaluaría cachear con TTL 24h e invalidación por re-fetch (patrón `arko_onboarding_completed` en `middleware.ts:149-179`). No para v1.

### 5a. Server (la seguridad real)
- **`src/lib/api/auth.ts:39-50`** — cambiar `.select('id')` → `.select('id, plan, trial_ends_at')` (0 round-trips extra), y `AuthResult` pasa a `{ userId, workspaceId, tier }` con `tier: resolveTier(workspace.plan, workspace.trial_ends_at)`.
- **`src/lib/api/guard.ts`** (NUEVO) — `requireFeature(request, feature)`: corre `authenticateRequest`, si `hasFeature(tier, feature)` es false → `api403(TRAP.description)`, si no devuelve el auth. **Una línea por ruta.**

**Rutas Demo-bloqueadas (server-enforced, Fase 1):**

| Ruta(s) bajo `src/app/api/v1/` | feature |
|---|---|
| `chat/route.ts` (+ `chat/sessions`, `chat/messages`) | `mokaAI` |
| `competitors/*` (route, `[id]/scrape`, `[id]/analyze`, `[id]/reels`, `[id]/reels/[reelId]/analyze`) | `competitors` |
| `reels/[id]/gemini-analyze` | `reelAiAnalysis` |
| `references/*` (`[id]/analyze-all`, `[id]/scrape`, `[id]/reels/[sc]/analyze`) | `audience` |
| `sales/[id]/payment` | `sales` |
| `content-plan` (GET/POST/PATCH/DELETE) | `worktable` |

`chat/route.ts` es SSE: emitir el 403 como `sseEvent({type:'error', message:TRAP.description})` + `controller.close()` **antes** de abrir el stream (patrón ya existente para auth-error).

### 5b. UI (cosmética, sin cookie)
- **`src/app/(dashboard)/layout.tsx:36,87`** — agregar `plan, trial_ends_at` al select existente; computar `const tier = isAdmin ? 'pro' : resolveTier(wsData?.plan ?? null, wsData?.trial_ends_at ?? null);` y pasar `tier={tier}` al `<Sidebar>`. (Admin nunca lockeado, sin meter lógica de admin en `resolveTier`.)
- **`src/components/layout/Sidebar.tsx`** — prop `tier?: Tier` (default `'pro'`); helper `isLocked(href) = !!ROUTE_FEATURE[href] && !hasFeature(tier, ROUTE_FEATURE[href]!)`.

---

## 6. DEMO — FASE 1 (URGENTE)

### 6.1 Sidebar
- **Visibles siempre:** Dashboard `/`, Reels `/instagram?tab=reels`, Historias `/instagram?tab=historias`, Publicaciones `/instagram?tab=publicaciones`, Settings/*.
- **Bloqueados en Demo (candado, NO ocultar):** Competencia, Tu Audiencia, Ventas, Mesa de Trabajo, Moka AI, YouTube, Meta Ads. Item bloqueado = **visible y clickable**, con badge de candado (reusar `Lock` de `lucide-react`) + texto en gris/dimmed. Al click navega a la ruta real → la página muestra la trampa. (El lead debe **ver lo que se pierde**.)

### 6.2 Pop-up trampa (texto + comportamiento + sin salida)
- **Texto exacto:** título `Este plan no está disponible.` / descripción `Comunicate con nuestro equipo para acceder a un plan premium con todas las funciones.`
- **Única salida:** botón **“Volver al dashboard”** → `/`. Sin link de upgrade, sin dismiss, sin cerrar al click fuera.
- **Render:** vía componente `FeatureLock` (§6.5).

### 6.3 Cap de reels propios enforced en el sync/display
- **`src/app/(dashboard)/instagram/page.tsx`** — agregar `plan, trial_ends_at` al select del workspace (hoy solo trae workspaceId + meta_connections), computar `tier`, y cambiar `.limit(200)` → `.limit(cfg(tier).ownReelsCap)` (12 demo, 200 resto). Historias `.limit(100)`/posts `.limit(200)`: dejar full por ahora (S2). Es display puro (Meta sync, gratis) → vive en el server component, **no** necesita budget guard.

### 6.4 Análisis IA + Moka AI OFF (server-enforced)
- Cubierto por §5a: `reels/[id]/gemini-analyze` (`reelAiAnalysis`), `chat/*` (`mokaAI`), `competitors/*` y `references/*` análisis → todos `requireFeature` → 403 antes de tocar LLM/Apify. **Defensa en profundidad:** UI muestra `FeatureLock`, server devuelve 403. Aunque el Demo fuerce la URL/parchee el cliente/pegue a la API directo, el server lee el plan **fresco** de la DB en cada request.

### 6.5 Componente `FeatureLock` — `src/components/common/FeatureLock.tsx` (NUEVO)
Extrae el markup de `AdnBlockOverlay` (`AdnAlertBanner.tsx:50-90` — el `absolute inset-0 z-40 … bg-background/70 backdrop-blur-sm rounded-xl` con candado), **parametrizado y agnóstico de i18n**:
```tsx
interface FeatureLockProps {
  title: string; description: string;
  ctaText?: string;   // default "Volver al dashboard"
  ctaHref?: string;   // default "/"
  variant?: 'overlay' | 'page';  // overlay = absolute inset-0 sobre el tab; page = min-h full
}
```
- **`AdnBlockOverlay` se reescribe como wrapper** de `FeatureLock` con sus strings i18n de ADN y CTA a `/onboarding/adn` → **no rompe** `AgentsClient`.
- **Trampa Demo:** `<FeatureLock variant="page" title={TRAP.title} description={TRAP.description} ctaText={TRAP.ctaText} ctaHref={TRAP.ctaHref} />`.

**Montaje por tipo de página:**
- **Page-level** (`/agents`, `/ventas`, `/mesa-de-trabajo`, `/youtube`, `/ads`): el server component computa tier y si `!hasFeature` → `FeatureLock variant="page"`. En `AgentsClient`: si demo → trampa; elif `adnPending` → overlay ADN.
- **Tab-level** (`/instagram?tab=competencia|metrics`): `instagram/page.tsx` ya es server component que fetchea workspace → pasa `tier` como prop a `CompetitorTab` / panel de métricas, que envuelven **solo el contenido del tab** con `FeatureLock variant="overlay"` (no el header/sidebar).
- **Deep-links** (`/instagram/competencia/[c]/[reel]`): server component → `redirect('/')` si demo.

---

## 7. ESTANDAR & PRO — FASE 2

> Diferible. Mapea los límites a las constantes existentes y activa el cap diario.

- **Competidores:** Standard 3 / Pro 5. Hoy **no enforced**. Punto: conteo en `POST competitors` (rechazar si `count >= clampCompetitors(tier, ...)`), y `MAX_SELECTION=5` en `CompetitorTab.tsx:1522`.
- **Reels por scrape:** Standard 20 / Pro 100. Mapear `MAX_REELS_PER_SCRAPE=100` (`competitor-scraper.service.ts:35`, pasado al actor en ~466) → `clampReels(tier, 100)` desde el caller (la ruta necesita `tier`). `MAX_BULK_REEL_IDS=5` (`competitors/[id]/analyze/route.ts:18`) → `clampReels(tier, 5)` al hacer `slice`. `REELS_PAGE_SIZE=20` queda como page size de UI.
- **Cap 0.50 USD/día (ambos):** §4 (budget-guard).
- **Regla:** borrar los literales dispersos y derivar todo de `TIER_CONFIG` vía `clampReels`/`clampCompetitors`.

---

## 8. Auto-downgrade al vencer trial

**Mecanismo elegido: NINGUNO (lazy), vía `resolveTier`.** Cuando `plan='standard'` y `trial_ends_at < now()`, `resolveTier` devuelve `'demo'` **en el instante** del vencimiento. Como server (`authenticateRequest`), UI (`layout`) y guard derivan todos de `resolveTier`, el downgrade es **instantáneo y consistente sin tocar la DB**.

**Por qué:** elimina cron/trigger de expiración y su modo de fallo silencioso, nunca está desincronizado, y la fila conserva `plan='standard'` (estado histórico que el admin ve en `/admin/clients` como “vencido” → **lead caliente preservado**).

**`[FASE 2, opcional, solo higiene de reporting — NO enforcement]:** `pg_cron` nocturno `UPDATE workspaces SET plan='demo' WHERE plan='standard' AND trial_ends_at < now();`. Que corra o no **no cambia** el comportamiento del usuario.

---

## 9. Admin — asignación manual del tier

- **Al invitar (FASE 1):** `src/app/(admin)/admin/invitations/InvitationForm.tsx` suma un selector de 3 vías → **DEMO** (lead-magnet) / **TRIAL** 30·60·90 (→ standard) / **PRO**. `createInvitation` en `invitations/actions.ts` valida e inserta `invitations.plan`. El trigger lo consume vía `COALESCE` (§2). Gotcha: si elige DEMO o PRO, `trial_days` se ignora (trial_* solo para standard).
- **Post-signup (FASE 1b — `[DIFERIBLE]` si aprieta el tiempo):** `updateClientPlan(workspaceId, plan)` en `src/app/(admin)/admin/clients/[id]/actions.ts`, **clon exacto** de `updateClientLanguage` pero `UPDATE workspaces SET plan=… WHERE id=…` (apoyado en la policy `admin_update_workspaces` de §2). Picker reusa el patrón de `ClientLanguagePicker` (`useTransition`). Gotcha (research): el admin elige el **workspace** del owner, no el usuario. El selector de invite cubre el flujo primario; este es el camino “cambiar después”.
- **RLS:** `admin_update_workspaces` (USING/WITH CHECK `is_admin()`) + trigger `prevent_plan_self_escalation` (§2) ya cubren seguridad. **Verificar `is_admin()` existe** (S8).

---

## 10. EDGE CASES → manejo (consolidado)

| Sev | Caso | Manejo simple | Fase |
|---|---|---|---|
| CRIT | Demo pega a la API directo (sin UI) | `requireFeature` lee plan fresco de DB → 403 antes de gastar | 1 |
| CRIT | `auth.ts` no traía plan/tier | select `+plan,trial_ends_at` (0 queries extra), return `tier` | 1 |
| CRIT | `WorkspacePlan='pro'` rompe TS | enum 3-valores + `onboarding_completed` en `Workspace` | 1 |
| CRIT | Signup sin invitación quedaba `'pro'` | trigger: sin invitación → `'demo'`; con invitación → `'standard'`; admin → `'pro'` | 1 |
| **CRIT** | **Usuario escala su propio `plan` a `'pro'` (owner UPDATE sin WITH CHECK)** | **trigger `prevent_plan_self_escalation` resetea plan/trial si no es admin** | 1 |
| HIGH | Admin baja plan mid-sesión → UI stale | server enforce en el próximo request (fresco); UI se corrige al re-render (layout fetchea cada render) | 1 |
| HIGH | Trial vence mid-acción (cruza medianoche) | `resolveTier` evalúa al inicio del request; `created_at` atribuye el costo al día real; over-billing < 0.1% aceptado | 1/2 |
| HIGH | Admin `emendoza@` con workspace standard vencido → demo | `layout`: `tier = isAdmin ? 'pro' : resolveTier(...)`; server: admin es `'pro'` por trigger | 1 |
| HIGH | Concurrencia cruza el cap | overshoot acotado aceptado (cap = target, no transacción); log post-hoc no bloquea | 2 |
| HIGH | `SUM(cost_usd)` lento sin índice compuesto | `idx_*_daily (workspace_id, created_at DESC)` | 2 |
| HIGH | `enrich-durations` concurrency=4 → logs parciales | batch log único tras `Promise.all` con `itemsCount=successCount` | 1/2 |
| HIGH | Pricing de modelo cae a $0 si no matchea | `console.warn` + fallback a precio máximo conocido (fail-open en costo) | 2 |
| MED | Datos de competidor tras downgrade pro→demo | **no borrar**; UI gatea con `FeatureLock`, API bloquea nuevos scrapes; restaura si re-upgrade | 1/2 |
| MED | SSE 403 en chat | `sseEvent({type:'error'})` + `close()` antes del stream (patrón existente) | 1 |
| MED | `is_admin()` podría no existir | **verificar**; si no, subquery inline `EXISTS(... role='admin')` en policy + trigger | 1 |
| LOW | Doble click → doble análisis/log | frontend deshabilita botón en request; idempotency key | 2 |
| LOW | `invitations.plan` NULL en invitaciones viejas | `COALESCE` lo maneja → sin backfill | 1 |
| LOW | Cookie de tier stale | **no se implementa cookie** (tier derivado fresco) | — |
| LOW | UX timezone (usuario AR vs reset UTC) | tooltip “reinicia a medianoche UTC” | 2 |

---

## 11. Plan POR FASES — file-by-file, orden DB→código

### FASE 1 — DEMO (esta semana). Orden estricto: **DB primero**.

**Paso 0 — DB (Dev Arko `hrsvglgswatwklivkoyp`):**
1. `\df is_admin` → confirmar que existe (S8). Si no, ajustar policy/trigger a subquery inline.
2. Aplicar `supabase/migrations/20260629000000_enable_tiers.sql` (§2). Verificar con los tests SQL (§12).

**Paso 1 — Config + tipos (sin dependencias de UI):**
3. `src/lib/tier/config.ts` — **NUEVO** (§3).
4. `src/types/database.ts` — `WorkspacePlan` 3-valores (L9) + `onboarding_completed` en `Workspace`.

**Paso 2 — Server gating (la seguridad real):**
5. `src/lib/api/auth.ts` — select `+plan,trial_ends_at`, return `tier`.
6. `src/lib/api/guard.ts` — **NUEVO** `requireFeature`.
7. Rutas API → reemplazar `authenticateRequest`+`isAuthError` por `requireFeature(request, <feature>)` (lista §5a): `chat/route.ts` (+`chat/sessions`,`chat/messages`), `competitors/*`, `reels/[id]/gemini-analyze`, `references/*`, `sales/[id]/payment`, `content-plan`.

**Paso 3 — UI cosmética:**
8. `src/components/common/FeatureLock.tsx` — **NUEVO** (extrae markup de `AdnBlockOverlay`).
9. `src/components/features/onboarding/AdnAlertBanner.tsx` — `AdnBlockOverlay` → wrapper de `FeatureLock`.
10. `src/app/(dashboard)/layout.tsx` — select `+plan,trial_ends_at`, computar `tier`, prop a `<Sidebar>`.
11. `src/components/layout/Sidebar.tsx` — prop `tier`, `isLocked`, badge candado + grey.
12. `src/app/(dashboard)/instagram/page.tsx` — select `+plan,trial_ends_at`, `.limit(cfg(tier).ownReelsCap)`, pasar `tier` a `CompetitorTab`/panel métricas.
13. Páginas/tabs: `AgentsClient`, `CompetitorTab`, panel de métricas, `/ventas`, `/mesa-de-trabajo`, `/youtube`, `/ads` → montar `FeatureLock`; deep-link `instagram/competencia/[c]/[reel]` → `redirect('/')`.

**Paso 4 — Admin manual:**
14. `src/app/(admin)/admin/invitations/InvitationForm.tsx` + `invitations/actions.ts` — selector plan 3-vías → `invitations.plan`.
15. `[DIFERIBLE a 1b]` `src/app/(admin)/admin/clients/[id]/actions.ts` + picker — `updateClientPlan`.

### FASE 2 — STANDARD/PRO + budget `[DIFERIBLE]`
16. `supabase/migrations/2026XXXX_daily_spend.sql` — índices compuestos + `get_daily_spend_usd` (+ opcional pg_cron higiene).
17. `src/lib/api/response.ts` — `api429`.
18. `src/lib/tier/budget-guard.ts` — **NUEVO** `requireBudget`/`estimateCost`/`getDailySpend`.
19. 9 rutas caras — `requireBudget(...)` antes de gastar (§4c).
20. `competitor-scraper.service.ts`, `competitors/[id]/analyze/route.ts`, `CompetitorTab.tsx` — `MAX_*` → `clampReels`/`clampCompetitors`; enforce conteo de competidores.
21. Fixes de integridad de costo: batch log en `enrich-durations`; latencia `/successCount` en `competitors/analyze`; derivar costo del `response.model` real.

---

## 12. Checklist de QA / test

**DB (post-migración, vía SQL en Dev Arko):**
- [ ] `resolveTier(null,null)='demo'`; `resolveTier('invalid',null)='demo'`; `resolveTier('standard',null)='standard'`; `resolveTier('standard', ayer)='demo'`; `resolveTier('pro', cualquiera)='pro'`. (unit test del módulo)
- [ ] Signup **sin** invitación → workspace `plan='demo'`, `trial_*` NULL.
- [ ] Signup con invitación **sin** `plan` (trial 30) → `plan='standard'`, `trial_ends_at = now()+30d`.
- [ ] Signup con invitación `plan='demo'` → `plan='demo'`, `trial_*` NULL (trial ignorado).
- [ ] Signup con invitación `plan='pro'` → `plan='pro'`, `trial_*` NULL.
- [ ] Signup admin email → `plan='pro'`.
- [ ] **Anti-escalación:** como usuario NO-admin, `UPDATE workspaces SET plan='pro' WHERE id=mi_ws` → el trigger lo **revierte** (plan sigue igual). Como admin → permite.
- [ ] Rollback de la migración corre limpio y deja `CHECK (plan='pro')`.

**Demo hermético (lo crítico — “no puede gastar ni por API directa”):**
- [ ] `POST /api/v1/chat` con token Demo válido → **403** `TRAP.description` (en SSE: evento `error` + close), **sin** llamada a LLM.
- [ ] `POST /api/v1/competitors/[id]/scrape` Demo → 403, **sin** llamada a Apify.
- [ ] `POST /api/v1/competitors/[id]/analyze` Demo → 403.
- [ ] `POST /api/v1/reels/[id]/gemini-analyze` Demo → 403.
- [ ] `POST /api/v1/references/[id]/analyze-all` y single Demo → 403.
- [ ] `POST /api/v1/content-plan` (todos los métodos) y `sales/[id]/payment` Demo → 403.
- [ ] Tras una ronda de intentos Demo, `SELECT get_daily_spend_usd(ws)` **= 0** (nada llegó a LLM/Apify).
- [ ] Reels propios Demo en `/instagram?tab=reels`: server devuelve **≤ 12**.

**UI Demo:**
- [ ] Sidebar: Competencia/Audiencia/Ventas/Mesa/Moka AI/YouTube/Ads visibles **con candado**, gris; Dashboard/Reels/Historias/Publicaciones normales.
- [ ] Click en item bloqueado → página con `FeatureLock`: texto exacto del SPEC, **única** salida “Volver al dashboard” → `/` (no cierra al click-fuera, sin upgrade link).
- [ ] Deep-link `/instagram/competencia/[c]/[reel]` Demo → redirect a `/`.
- [ ] `/agents` Demo → trampa; con ADN pendiente y plan ON → overlay ADN (no romper `AgentsClient`).

**Standard/Pro + downgrade:**
- [ ] Standard activo: features ON; competidores ≤ 3, reels ≤ 20 `[FASE 2]`.
- [ ] Pro: competidores ≤ 5, reels ≤ 100 `[FASE 2]`.
- [ ] **Downgrade:** poner `trial_ends_at` en el pasado a un workspace standard → **siguiente request** lo trata como Demo (403 en features caras) **sin** tocar la DB; `/admin/clients` sigue mostrando `plan='standard'` (vencido).
- [ ] **Cap diario `[FASE 2]`:** seedear `llm_usage`/`integration_usage` ~0.50 USD hoy → la siguiente operación standard/pro devuelve **429** con `{spent,cap}`.
- [ ] Admin invita con cada plan (3 vías) → el workspace nace con el tier correcto.

---

## 13. Docs / CHANGELOG a actualizar (reglas del proyecto)

> Mandamiento: ningún cambio sin doc + CHANGELOG.

- **`docs/features/moka-coins.md`** (ya existe sin commitear) o **`docs/features/tiers.md`** (NUEVO) — doc-feature del sistema 3-tier: tabla de entitlements, `resolveTier`, gating server/UI, trampa Demo, auto-downgrade lazy. **Definir el archivo canónico antes de empezar** (no duplicar).
- **`docs/DB_SCHEMA.md`** — `workspaces.plan` (dominio `demo|standard|pro`, default `demo`), `invitations.plan`, trigger `handle_new_user` (lógica de tier), trigger `prevent_plan_self_escalation`, policy `admin_update_workspaces`, `[FASE 2]` `get_daily_spend_usd` + índices.
- **`docs/API_DOCS.md`** — respuesta **403** (feature no disponible, texto trampa) en las rutas gateadas; `[FASE 2]` **429** budget con `{spent,cap}`.
- **`docs/03-security.md`** — RLS admin update + trigger anti-escalación de plan; nota de que el tier se enforce server-side y la UI es cosmética.
- **`docs/features/admin-panel.md`** — selector de tier en invitaciones; `[DIFERIBLE]` `updateClientPlan` en `/admin/clients/[id]`.
- **`docs/features/onboarding-adn.md`** / `08-design-system.md` — `AdnBlockOverlay` ahora es wrapper de `FeatureLock` (nuevo componente común reutilizable).
- **CHANGELOG** — entrada `feat(tiers): sistema 3-tier DEMO/STANDARD/PRO + gating server-side + trampa Demo (Fase 1)`; nota de **migración Dev Arko pendiente de PROD**.

**Git (regla del proyecto):** rama `feature/3-tier-system` desde `develop`; al cerrar, PR **a develop** (nunca a main); reportar migraciones DEV pendientes en PROD.

---

### Archivos nuevos (3 en Fase 1) y tocados — resumen
**Nuevos F1:** `supabase/migrations/20260629000000_enable_tiers.sql`, `src/lib/tier/config.ts`, `src/lib/api/guard.ts`, `src/components/common/FeatureLock.tsx`.
**Tocados F1:** `src/types/database.ts`, `src/lib/api/auth.ts`, `src/app/(dashboard)/layout.tsx`, `src/components/layout/Sidebar.tsx`, `src/app/(dashboard)/instagram/page.tsx`, `src/components/features/onboarding/AdnAlertBanner.tsx`, ~10 rutas API, `AgentsClient`+`CompetitorTab`+páginas `/ventas` `/mesa-de-trabajo` `/youtube` `/ads`+deep-link, `InvitationForm.tsx`+`invitations/actions.ts`.
**Nuevos F2:** `supabase/migrations/2026XXXX_daily_spend.sql`, `src/lib/tier/budget-guard.ts`. **Tocados F2:** `src/lib/api/response.ts` (`api429`), 9 rutas caras, `competitor-scraper.service.ts`, `competitors/[id]/analyze/route.ts`, `CompetitorTab.tsx`, `[DIFERIBLE]` `admin/clients/[id]`.