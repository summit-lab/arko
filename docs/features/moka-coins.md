# Moka Coins — Sistema de Créditos de Arko

> **Estado v2 (2026-07-02):** el scrape de datos (competidores/referencias, manual y cron) pasó a categoría **`service` y NO debita** — solo la IA on-demand paga. Regla anti-drenaje: ningún click come >150 coins (techo duro `MAX_COINS_PER_MESSAGE` en el chat + clamps por tier + análisis de competidor capado por día). Previsto "~X Moka" en botones caros (`credit-estimates.ts` + `CoinCost`). Ver CHANGELOG 2026-07-02 y migraciones `20260702*`.
> **Estado v1:** **v1 IMPLEMENTADO y en Prod (2026-07-01)** — versión LEAN. Este documento es el diseño COMPLETO/aspiracional; v1 shippeó un subconjunto. **Qué shippeó:** 1 billetera diaria combinada por workspace (`workspace_credit_balances`), trigger `AFTER INSERT` que SOLO acumula gasto, chip en vivo por Realtime, banner de alertas, guard `assertCredits` en modo SOFT, y control de admin (unlimited/bonus/reset) vía RPC `moka_admin_adjust`. **Diferencias con este doc:** tiers reales `demo/standard/pro` (no trial/paid/expired), **1 MC = $0.001** (no $0.01), allotment demo 150 / standard·pro 500, sin ledger/hold/precheck (post-launch). Ver `CHANGELOG.md` (2026-07-01) y `supabase/migrations/20260701*`.
> **Tipo:** Documentation-Driven Development — leer antes de codear.
> **Alcance:** Next.js App Router + Supabase/Postgres, multi-tenant por workspace, escala 100+ usuarios, RLS.
> **Docs relacionados:** `docs/features/admin-panel.md`, `docs/03-security.md`, `docs/DB_SCHEMA.md`, `docs/07-mcp-guide.md`, `docs/features/team-collaboration.md` (trials PR #131).
>
> **Decisiones del dueño (lockeadas 2026-06-22):**
> 1. **Target = Prod** (`zphvrohosizkbrnxtppj`). Override explícito del dueño a la regla Dev-first de CLAUDE.md §5 (igual que F2.5-5).
> 2. **Modelo de metering = Servicio gratis + on-demand paga** (§3.4): las coins solo se gastan en acciones que el cliente pide a demanda; la base del producto (sync propio, refresh programado, carga base de competidores/referencias) NO debita y se acota por **límites estructurales por plan** (§4.4).
> 3. **Topes diarios por categoría:** Trial 50 MC/día ($0.50, $15/mes) · Pago 150 MC/día ($1.50, $45/mes).
> 4. **Trial vencido = bloqueo (caps 0)**, pero **TODO override-able por workspace desde admin** (extender/aplazar trial, acreditar, subir topes, apagar enforcement).
> 5. **Pricing Apify real** (medido): ~$0.0083/reel, ~$0.0025/post, profile ~gratis, reel individual on-demand ~$0.05. Markup ~1.1x (ya no 1.5x).

---

## 1. Resumen ejecutivo

Moka Coins es el sistema de créditos de Arko para limitar y medir TODO lo que genera costo externo, separado en dos billeteras independientes: **IA** (chat Moka, análisis de reels con Gemini, auto-títulos, diagnósticos, clasificación de hooks) y **Scraping** (competencia, referencias y enriquecimiento de reels vía Apify). Una Moka Coin (MC) vale exactamente US$0.01: el costo en coins se **deriva** del `cost_usd` real ya calculado por `calculateCost()`/`getOperationCost()`, así nunca se sobre ni subfactura. El gasto del usuario se debita de forma **post-pago, atómica y garantizada dentro de un trigger `AFTER INSERT`** sobre las tablas de usage existentes (`llm_usage`, `integration_usage`), de modo que la integración en los call sites tiende a cero. Las coins **solo se gastan en acciones on-demand** (análisis IA, re-scrapes manuales, chat); el sync de la cuenta propia, el refresh programado y la **carga base** de competidores/referencias son **servicio** (no debitan) y se acotan por **límites estructurales por plan** (§3.4, §4.4). Cada categoría tiene **doble cota — diaria y mensual** por capa (trial 50 MC/$0.50/día, pago 150 MC/$1.50/día) que impide matemáticamente quemar el mes. Un **pre-check con reserva (hold) atómica** corta el abuso por ráfaga; un **sweeper de reconciliación** recupera cargos huérfanos; el costo de **cron/sistema NO debita al usuario**; y todo arranca en modo **soft (visibilidad)** alineado con los trials v1 del PR #131, encendiéndose el hard-gate por workspace recién con datos reales de calibración.

---

## 2. Objetivos y no-objetivos

### Objetivos

- **Medir y limitar** el costo externo real (IA + Scraping) por workspace, con tope diario Y mensual por categoría.
- **UX trivial:** el usuario entiende cuánto le queda mirando dos barras ("IA hoy: 32/50", "Scraping hoy: 18/50"). Cero tokens, cero USD, cero recargas manuales.
- **Integración mínima:** un solo punto de enganche real para todo el gasto (trigger DB), no esparcir lógica por 12 call sites.
- **Fidelidad al costo real:** peg 1:1 al USD, derivado de la fuente única de pricing ya existente.
- **Capas distintas:** trial vs pago, con allotments diferentes; add-ons desbloqueables por el admin, por workspace.
- **Correctitud bajo concurrencia, retries, fallos parciales y abuso** (anti-doble-cobro, anti-quema, anti-burst).
- **Auditabilidad total:** ledger append-only de cada débito, crédito, refund, reset, grant, addon y revocación.

### No-objetivos (v1)

- **NO** hay billing real (Stripe/pagos). "Pago" hoy es un *tier* configurable, no un cobro. La capa "paid" sólo se alcanza por acción de admin, nunca por el mero vencimiento del trial.
- **NO** hay rollover de coins no usados: lo que no se gasta se pierde a medianoche (diario) y el día 1 (mensual). Declarado explícitamente para que el cliente no reclame coins "desaparecidos".
- **NO** se factura al usuario el costo de mantenimiento/sistema (sync IG por cron, watchdogs, enrichment automático). Ese gasto se reconcilia aparte.
- **NO** se expone al usuario el costo variable real por operación (un video Gemini "vale" más que un chat); sólo ve bajar la barra más o menos.
- **NO** hay enforcement duro al lanzar: v1 arranca soft (visibilidad), igual que los trials.

---

## 3. El modelo Moka Coins

### 3.1 Qué es 1 Moka Coin

**1 Moka Coin (MC) = US$0.01 (un centavo). Peg duro 1:1.**

```
coins = round(cost_usd * 100, 2)
```

- Se eligió el **centavo** (no el dólar) porque ~90% de las operaciones cuestan entre $0.0003 y $0.05. Con peg al dólar el usuario vería "0 coins" en casi todo. Con centavos la escala es legible: un mensaje de chat Sonnet caro (~$0.15) = 15 MC; un mensaje simple (~$0.002) = 0.2 MC.
- **Internamente** el ledger y los balances guardan `numeric(12,2)` en coins para no perder precisión sub-centavo en operaciones baratas (un título Haiku ~$0.0009 = 0.09 MC). La **UI redondea a entero**.
- Nunca usar `float` para montos (drift de redondeo). Siempre `numeric`, como ya hacen `llm_usage.cost_usd` / `integration_usage.cost_usd` (`numeric(10,6)`).

### 3.2 Las dos categorías (billeteras independientes)

DOS categorías estrictamente separadas, con presupuestos independientes (requisito inviolable). Agotar IA NO afecta scraping y viceversa.

| Categoría | Qué incluye | Fuente de costo |
|-----------|-------------|-----------------|
| **`ai`** | chat Moka (ai-agents / ai-agents-light), onboarding ADN, análisis de video propio (arkoai-video-analysis), análisis de reel de competidor (competitor-analysis), análisis de referencia (reference-analysis), auto-título (reel-auto-title), clasificación de hooks (hooks-classify) | `llm_usage.cost_usd` |
| **`scraping`** | enrich-durations, reel individual (reel-scrape), scrape de competidor (profile + reels + grid), scrape de referencia | `integration_usage.cost_usd` |

Además, dos categorías **NO facturables al usuario**:

| Categoría | Qué incluye | Comportamiento |
|-----------|-------------|----------------|
| **`system`** | gasto de cron/background: ig-sync-enrichment, ig-reel-enrichment, stories sync, watchdogs, token refresh | Se loguea y reconcilia en admin, pero **NO debita** la billetera del workspace (ver §12 hallazgo crítico). |
| **`service`** | base del producto incluida en la suscripción: **carga base** + **refresh programado** de competidores/referencias (traer reels para que la feature exista) | **NO debita** — es parte del servicio. Se acota por **límites estructurales por plan** (§4.4), no por coins. Costo reconciliado en admin (§13). |
| **`unmapped`** | feature/operation nueva no mapeada todavía | **NO debita**, dispara alerta al admin para que la mapee. Fallback **seguro** (nunca cobra ciego). |

El mapeo `feature`/`operation` → categoría vive en la tabla canónica `moka_category_map` (§7), seedeada exhaustivamente con TODOS los strings que aparecen en el código (grep de `feature:`/`operation:` en routes + edge functions), porque la misma operación física aparece con distintos strings (ej. `reel-scrape` aparece como `ig-sync-enrichment`, `ig-reel-enrichment`, `enrich-durations`).

### 3.3 Peg interno a USD, UX simple

- El **costo en coins NO se hardcodea por acción**: se deriva de `cost_usd` real ya calculado. Fuente única de verdad, cero pricing duplicado.
- El usuario **nunca ve USD ni tokens**: dos barras, 1 coin = 1 centavo, reset automático.
- Dos acciones idénticas pueden bajar la barra distinto (un video Gemini que hace tier-up cuesta 15x más): se acepta como honesto, y para las operaciones caras se muestra un **hint sutil pre-acción** ("Esta acción usa ~X Moka", §10).

### 3.4 Servicio vs on-demand — qué consume coins y qué no

**Principio (decisión del dueño):** las Moka Coins miden el uso **on-demand** (acciones puntuales que dispara el cliente con un click), NO "que el servicio funcione". El costo de la base del producto se absorbe como costo de servicio y se acota con **límites estructurales por plan** (§4.4), no con coins.

| Plano | Operaciones | ¿Debita coins? | Cómo se acota el costo |
|-------|-------------|----------------|------------------------|
| **Servicio** (base del producto, incluida en la suscripción) | Sync de la cuenta propia (reels/stories/posts/insights); **refresh programado** de competidores/referencias ya seguidos (cron); **carga base** de un competidor/referencia al agregarlo | **NO** (`system` / `service`) | **Límites estructurales por plan** (§4.4): máximo de competidores/referencias seguibles, frecuencia del refresh, y cap de reels por carga base. Controla NUESTRO costo de Apify. |
| **On-demand** (valor puntual pedido con un click) | Análisis IA de un reel/competidor/referencia (Gemini/Claude); chat con Moka; **re-scrape manual** / "traer más reels" / "actualizar ahora" más allá del refresh | **SÍ** (`ai` / `scraping`) | Coins (doble cota diaria+mensual) + **cap de reels por scrape manual** + hint pre-acción. |

**Por qué (con el pricing real de Apify):** un scrape completo de competidor (perfil + 100 reels + posts) ≈ **US$0.83–1.33 = 83–133 MC**, más que el tope diario de scraping. Si la carga base descontara coins crudas, un solo "agregar competidor" fundiría el día — pero traer esos reels es parte del servicio. Por eso la carga base/refresh **no debita** y se limita por **cantidad** (estructural); las coins quedan para lo que el cliente repite a demanda (análisis, re-scrapes manuales).

**Implicación técnica:** el call site **estampa el `operation`/`feature` correcto** para que el trigger sepa si debita. Ej: `competitor-base-load` y `competitor-scheduled-refresh` → `service` (no debita); `competitor-manual-rescrape` → `scraping` (debita). El mapeo vive en `moka_category_map` (§7.2).

---

## 4. Economía y pricing

### 4.1 Tabla: acción → costo real estimado USD → costo en coins

> El costo en coins se **deriva en runtime** de `cost_usd`; estos números son anclajes del recon para calibrar caps y comunicar el hint. NO se hardcodean como tarifa.

| Categoría | Acción | Modelo / Actor | Costo real estimado (USD) | Coins (MC) |
|-----------|--------|----------------|---------------------------|------------|
| ai | Onboarding ADN (1 msg) | gpt-4.1-mini (x2 si follow-up) | $0.0004–0.0008 | 0.04–0.08 |
| ai | Chat simple (ai-agents-light) | gpt-4.1-mini, 1 call | $0.001–0.003 | 0.1–0.3 |
| ai | Chat complejo (ai-agents) | claude-sonnet-4-6, tool loop x1–5 | $0.05–0.30 (peor histórico ~$1.50) | 5–30 (peor ~150) |
| ai | Análisis video propio | gemini-2.5-flash (tier-up pro/GPT-4o) | $0.01–0.05 (tier-up 5–15x) | 1–5 (tier-up hasta ~75) |
| ai | Análisis reel competidor (video) | gemini-2.5-flash x5 reels | $0.05–0.20 | 5–20 |
| ai | Análisis referencia (text-only) | gemini-2.5-flash x5 | $0.002–0.004 | 0.2–0.4 |
| ai | Auto-título | claude-haiku-4-5 | $0.0006–0.0012 | 0.06–0.12 |
| ai | Clasificación hooks (batch 20) | gemini-2.5-flash | $0.0005–0.0015 | 0.05–0.15 |
| scraping (on-demand) | Reel individual (re-scrape / refresh URL Gemini) | apify reel-scraper | ~$0.01–0.09 (≈$0.05) | ~1–9 (≈5) |
| scraping (on-demand) | Enrich-durations (20 reels) | apify reel-scraper | ~$0.17 ($0.0083×20) | ~17 |
| scraping (on-demand) | Re-scrape manual competidor (100 reels) | apify reel-scraper | ~$0.83 | ~83 |
| **servicio** (NO debita) | Scrape **base** referencia | profile (~$0) + reels | ~$0.10–0.42 | — |
| **servicio** (NO debita) | Scrape **base** competidor (perfil+100 reels+200 posts) | $0 + $0.83 + ~$0.50 | **~$0.83–1.33** | — |

> **Pricing Apify medido (tu captura):** Reel Scraper 100=$0.83 / 72=$0.60 → **~$0.0083/reel**; Post Scraper 20=$0.05 → ~$0.0025/post; Profile ~gratis; reel individual on-demand $0.01–0.09.
> **El scrape base de competidor (~$0.83–1.33) es el evento más caro → por eso es `service` (NO debita)**, acotado por límites estructurales (§4.4). Los **re-scrapes manuales SÍ** debitan, capados en cantidad de reels.

### 4.2 Allotments: diario + mensual por categoría

| Capa | Categoría | Diario | Mensual |
|------|-----------|--------|---------|
| **Trial** (30/60/90 días) | ai | 50 MC ($0.50) | 1500 MC ($15) |
| **Trial** | scraping | 50 MC ($0.50) | 1500 MC ($15) |
| **Pago** (`paid`) | ai | 150 MC ($1.50) | 4500 MC ($45) |
| **Pago** | scraping | 150 MC ($1.50) | 4500 MC ($45) |
| **Expired** (trial vencido sin upgrade) | ai / scraping | **0 (bloqueo)** | 0 |
| **Admin** (cuenta admin) | ai / scraping | ilimitado | ilimitado |

Los allotments viven en `moka_plan_allotments` y se editan **sin migración**. **Expired = bloqueo total (0)**, pero el admin puede por workspace: extender/aplazar el trial, acreditar coins, subir el cap (add-on) o apagar el enforcement (§6, §11). El mensual = diario × 30 (trial 50×30=1500; pago 150×30=4500).

### 4.3 Cómo el tope diario evita quemar el mes

- **Matemática:** diario × 30 = mensual (trial 50×30 = 1500; pago 150×30 = 4500). Diario y mensual alineados.
- **El diario es el freno anti-quema:** aunque el mensual tenga saldo, si el diario se agota la operación se bloquea hasta el reset de medianoche. Imposible consumir más del tope diario de la capa por categoría → imposible gastar el mes en pocos días.
- **Doble cota obligatoria:** el pre-check y el guard del débito chequean AMBAS en el mismo statement: `daily_spent + hold <= daily_cap AND monthly_spent + hold <= monthly_cap`. Ninguna se perfora por carrera.
- **Anti-burst:** el pre-check **reserva** (hold pesimista) en vez de sólo leer "saldo > 0", de modo que N requests concurrentes se serializan y se bloquean entre sí (§8). Sin reserva, el diario sería perforable y el mensual se consumiría en 1–2 días de ráfagas.

### 4.4 Límites estructurales por plan (acotan el costo de servicio)

El costo de **servicio** (carga base + refresh programado, que NO debita coins) se controla con cupos estructurales por capa — editables desde admin y override-ables por workspace:

| Límite | Trial | Pago | Por qué |
|--------|-------|------|---------|
| Competidores seguibles | ej. 3 | ej. 10 | Cada uno trae carga base + refresh → costo Apify absorbido. |
| Referencias seguibles | ej. 5 | ej. 20 | Ídem. |
| Frecuencia de refresh programado | ej. semanal | ej. cada 3 días | Más frecuente = más costo absorbido. |
| Reels por carga base | ej. 50 (~$0.42) | ej. 100 (~$0.83) | Cap del fan-out de la carga base. |
| Reels por re-scrape manual (on-demand) | ej. 50 | ej. 100 | Acota el golpe de coins de un click (50 reels ≈ 42 MC entra en el diario). |

> Números de ejemplo — **a calibrar** (decisión abierta §15). Viven junto a los allotments (`moka_plan_allotments` o sibling `moka_plan_limits`), editables sin migración. Sin estos límites, "carga base gratis" sería un agujero (agregar 50 competidores = 50 cargas base gratis); con ellos, el costo de servicio queda acotado y predecible.

---

## 5. Capas: trial vs pago vs add-ons

### 5.1 Resolución de la capa (`moka_tier`)

La capa se resuelve por **estado de trial**, **desacoplada del `plan='pro'` hardcodeado** (todos los workspaces son `plan='pro'` por CHECK constraint; usar `plan` para resolver la capa haría que vencer el trial *suba* los límites, lo contrario al objetivo).

```
moka_tier ∈ ('trial', 'paid', 'expired', 'admin')
```

| Condición | tier resultante |
|-----------|-----------------|
| `profiles.role = 'admin'` (cuenta admin) | `admin` (ilimitado) |
| `trial_ends_at IS NOT NULL AND trial_ends_at > now()` | `trial` |
| `trial_ends_at <= now()` y no hay upgrade de admin | `expired` (**caps 0 = bloqueo**; admin puede extender/aplazar/acreditar por workspace) |
| Upgrade explícito de admin (futuro billing) | `paid` |

> **Importante:** `paid` SÓLO se alcanza por una acción de admin (`moka_set_tier`) o billing futuro, **nunca** por el mero vencimiento del trial. `plan='pro'` (único plan en DB) **≠ "pago habilitado"** hasta que exista cobro real.

### 5.2 Integración con el sistema de trials existente (PR #131)

- El admin elige 30/60/90 días al invitar (`invitations.trial_days`). El trigger `handle_new_user()` ya estampa `trial_days`/`trial_started_at`/`trial_ends_at` en el workspace al **registro**.
- Se **extiende** `handle_new_user()` (igual que hizo `trial_plans`) para **SIEMPRE** crear las 2 filas `moka_balances` (`ai`, `scraping`) de todo workspace nuevo, resolviendo el tier en ese momento.
- **Backfill migration** crea las filas para los 18 workspaces existentes en prod (que no pasaron por el trigger nuevo).
- La capa se **recalcula en vivo en cada pre-check** (no se confía en caps cacheados que quedarían stale al vencer el trial a mitad de mes, §12).

---

## 6. Add-ons desde admin

Add-ons desbloqueables por el admin, por workspace, sin migración. Suben el cap efectivo: `cap_efectivo = base(allotment según tier) + addon`.

### 6.1 Catálogo de add-ons

| Add-on | Efecto | RPC |
|--------|--------|-----|
| **Grant one-off** ("acreditar Moka Coins") | Reduce el `*_spent` del día/mes de una categoría (destraba consumo ya hecho). Ej: cliente quemó scraping en onboarding pesado → acredita contra el contador que bloquea. | `moka_admin_grant` |
| **+Tope diario / mensual** ("pack scraping pro") | Sube `addon_daily_mc` / `addon_monthly_mc` de una categoría de forma persistente. | `moka_set_addon` |
| **Cambiar tier** | Pasa el workspace a `paid` (o vuelve a `expired`). | `moka_set_tier` |
| **Ajustar allotments globales** | Edita `moka_plan_allotments` (afecta a TODOS los workspaces de ese tier; acción de alto impacto). | UPDATE directo (admin) |
| **Toggle enforcement** | `settings.moka_enforce` por workspace: soft (visibilidad) ↔ hard-gate. | `moka_set_enforce` |
| **Revocar grant/addon** | Inversa segura del grant/addon (ver §6.3). | `moka_admin_revoke` |

### 6.2 Cómo se aplican

- Todo desde el admin panel existente (`src/app/(admin)`), reusando el patrón `updateClientLanguage` (server action `'use server'` + re-check `role==='admin'` IN-action + `revalidatePath`) y un control inline tipo `ClientLanguagePicker` en `/admin/clients/[id]`.
- Todas las acciones de admin pasan por **RPC SECURITY DEFINER gated `is_admin()`** (gate explícito `IF NOT is_admin() THEN RAISE EXCEPTION 'forbidden'`, no sólo confiar en GRANT), invocadas con el **cliente RLS-respecting** (`createClient()`) para que `auth.uid()` exista. Escriben fila en `moka_ledger` (quién/cuándo/cuánto/por qué) para auditoría.
- Opcional: add-ons pre-provisionables al invitar (extender `invitations` + `handle_new_user`, como `trial_days`).
- Nueva tab opcional **`/admin/coins`** (`AdminSidebar.navItems`) con ledger, balances y reconciliación de todos los workspaces.

### 6.3 "Admin acredita y luego revoca" (revocación segura)

- `moka_admin_revoke(workspace_id, category, grant_idempotency_key, reason)`:
  1. Inserta fila ledger `kind='admin_revoke'` enlazada al grant original (`revokes = grant_idempotency_key`, UNIQUE → no doble-revoca).
  2. Resta del cap/saldo **SÓLO la porción NO consumida**: `revoke_amount = min(grant_amount, cap_efectivo - spent)`. **Nunca** reintroduce cobro de consumo pasado, nunca deja `spent > cap` por revocar lo ya gastado.
  3. Escribe `user_id` del admin + `reason`.
- `moka_set_addon` a la baja: igualmente clampea (no baja el cap por debajo de lo ya consumido) y escribe ledger `kind='addon'` con delta negativo.
- **Política explícita:** revocar reduce cap futuro, jamás re-cobra consumo pasado.

---

## 7. Modelo de datos

Greenfield. 4 tablas + funciones SECURITY DEFINER. Todo keyed por `workspace_id REFERENCES workspaces(id) ON DELETE CASCADE` (como todo dominio de Arko). Convenciones de índices/RLS copiadas de `llm_usage`/`integration_usage`, **excepto** las policies INSERT (ver §7.5 — anti-patrón).

### 7.1 `moka_plan_allotments` — tarifario de capas (editable sin migración)

```sql
CREATE TABLE public.moka_plan_allotments (
  tier            text NOT NULL CHECK (tier IN ('trial','paid','expired','admin')),
  category        text NOT NULL CHECK (category IN ('ai','scraping')),
  daily_cap_mc    numeric(12,2) NOT NULL DEFAULT 0,
  monthly_cap_mc  numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (tier, category)
);
-- Seed: trial 50/1500, paid 150/4500, expired 0/0, admin 1e9/1e9 por categoría.
```

### 7.2 `moka_category_map` — mapeo feature/operation → categoría

```sql
CREATE TABLE public.moka_category_map (
  source    text NOT NULL CHECK (source IN ('llm','integration')),
  key       text NOT NULL,                       -- feature (llm) u operation (integration)
  category  text NOT NULL CHECK (category IN ('ai','scraping','system','service','unmapped')),
  PRIMARY KEY (source, key)
);
-- Seed EXHAUSTIVO de todos los strings reales (grep): onboarding-adn, ai-agents,
-- ai-agents-light, arkoai-video-analysis, competitor-analysis, reference-analysis,
-- reel-auto-title, hooks-classify -> 'ai'.
-- ON-DEMAND -> 'scraping' (DEBITA): reel-rescrape, enrich-durations,
--   competitor-manual-rescrape, reference-manual-rescrape.
-- SERVICIO -> 'service' (NO debita; acotado por limites estructurales §4.4):
--   competitor-base-load, competitor-scheduled-refresh, reference-base-load,
--   reference-scheduled-refresh.
-- SISTEMA -> 'system' (NO debita): ig-sync-enrichment, ig-reel-enrichment,
--   stories-sync, watchdog, token-refresh.
-- Fila no encontrada -> categoría 'unmapped' (NO debita, alerta admin).
```

### 7.3 `moka_balances` — fila materializada por workspace+categoría (fast-path)

```sql
CREATE TABLE public.moka_balances (
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category         text NOT NULL CHECK (category IN ('ai','scraping')),
  tier             text NOT NULL DEFAULT 'expired'
                     CHECK (tier IN ('trial','paid','expired','admin')),
  daily_spent_mc   numeric(12,2) NOT NULL DEFAULT 0,
  monthly_spent_mc numeric(12,2) NOT NULL DEFAULT 0,
  hold_mc          numeric(12,2) NOT NULL DEFAULT 0,  -- reservas activas (hold) sin settlear
  day              date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
  month            date NOT NULL DEFAULT date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
  addon_daily_mc   numeric(12,2) NOT NULL DEFAULT 0,
  addon_monthly_mc numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, category)
);
-- Caps efectivos se resuelven EN VIVO via JOIN a moka_plan_allotments por tier + addon_*
-- (no se cachean los caps -> evita stale al vencer trial a mitad de ciclo).
-- Backstop CHECK (cota DB, última línea de defensa contra RPC buggy):
ALTER TABLE public.moka_balances
  ADD CONSTRAINT moka_balances_spent_sane
  CHECK (daily_spent_mc >= 0 AND monthly_spent_mc >= 0 AND hold_mc >= 0);
```

> Notas de diseño:
> - `tier` se materializa pero los **caps no** (se resuelven en vivo en el pre-check vía JOIN a `moka_plan_allotments`). Esto cierra el gap de transición trial→expired stale.
> - El día se calcula en **`America/Argentina/Buenos_Aires`**, no `current_date` desnudo (§9).
> - El backstop CHECK reemplaza al `balance >= 0` clásico (que post-pago no puede tener): acota el "max overspoint" para que un RPC buggy no corra el ledger sin límite.

### 7.4 `moka_ledger` — append-only audit + idempotencia

```sql
CREATE TABLE public.moka_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id         uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = sistema/cron
  category        text NOT NULL,
  amount_mc       numeric(12,2) NOT NULL,         -- +crédito / -débito
  kind            text NOT NULL CHECK (kind IN
                    ('debit','refund','admin_grant','admin_revoke','reset','addon','depleted')),
  reason          text NULL,
  usage_id        uuid NULL,                       -- FK lógico a llm_usage / integration_usage
  usage_source    text NULL CHECK (usage_source IN ('llm','integration')),
  idempotency_key text NOT NULL,
  refund_of       text NULL,                       -- idempotency_key del débito refundado
  revokes         text NULL,                       -- idempotency_key del grant revocado
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moka_ledger_idem_uniq UNIQUE (workspace_id, idempotency_key),
  CONSTRAINT moka_ledger_amount_nonzero CHECK (kind = 'reset' OR amount_mc <> 0)
);
CREATE INDEX idx_moka_ledger_workspace ON public.moka_ledger (workspace_id);
CREATE INDEX idx_moka_ledger_created ON public.moka_ledger (created_at DESC);
CREATE INDEX idx_moka_ledger_ws_cat_created ON public.moka_ledger (workspace_id, category, created_at DESC); -- compuesto que faltaba en usage
CREATE UNIQUE INDEX idx_moka_ledger_refund_of ON public.moka_ledger (refund_of) WHERE refund_of IS NOT NULL; -- anti-doble-refund
CREATE UNIQUE INDEX idx_moka_ledger_revokes  ON public.moka_ledger (revokes)  WHERE revokes  IS NOT NULL; -- anti-doble-revoke
```

> `user_id` es **NULL-able** (NO copiar el `NOT NULL` de `llm_usage`): si fuera NOT NULL, el INSERT de `reset` desde cron (sin `auth.uid()`) violaría la constraint y el reset fallaría en silencio → todos los clientes bloqueados al día siguiente.

### 7.5 RLS

```sql
ALTER TABLE public.moka_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moka_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moka_plan_allotments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moka_category_map    ENABLE ROW LEVEL SECURITY;

-- moka_balances: el usuario ve su saldo (benigno, sólo números). initplan con (select auth.uid()).
CREATE POLICY moka_balances_select ON public.moka_balances
  FOR SELECT USING (is_workspace_member(workspace_id) OR is_admin());

-- moka_ledger: SOLO admin lee el ledger crudo (tiene reasons de grants, info comercial interna).
-- El owner ve SU consumo via una VIEW/RPC agregada (sin reason ni admin_grant detail).
CREATE POLICY moka_ledger_select_admin ON public.moka_ledger
  FOR SELECT USING (is_admin());
-- Owner (no viewer/member) puede ver su propio ledger de debit/refund si se decide exponerlo:
CREATE POLICY moka_ledger_select_owner ON public.moka_ledger
  FOR SELECT USING (
    kind IN ('debit','refund')
    AND EXISTS (SELECT 1 FROM workspaces w
                WHERE w.id = workspace_id AND w.owner_id = (select auth.uid()))
  );

-- moka_plan_allotments / moka_category_map: SELECT admin; UPDATE/INSERT sólo admin.
CREATE POLICY moka_allotments_admin ON public.moka_plan_allotments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY moka_catmap_admin ON public.moka_category_map
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
```

> **CRÍTICO — NO copiar la policy INSERT de `llm_usage`** (`WITH CHECK (user_id = auth.uid())`). `moka_balances` y `moka_ledger` **NO** tienen NINGUNA policy INSERT/UPDATE/DELETE para `authenticated`/`anon`. Todo write pasa por RPC SECURITY DEFINER (service-role o admin-JWT). Si se replicara esa policy, cualquier authenticated podría insertar `kind='admin_grant'` con `user_id` propio → **auto-crédito total** (rompe el requisito inviolable). Red de seguridad: assert al final de la migración que verifica que no existen policies `cmd='INSERT'` sobre `moka_ledger`.

### 7.6 RPCs (todas `SECURITY DEFINER SET search_path='public, pg_temp'`)

| RPC | Quién la invoca | GRANT EXECUTE | Auth interna |
|-----|-----------------|---------------|--------------|
| `moka_precheck(workspace_id, category, hold_mc)` | backend (route) + front (lectura) | `service_role`, `authenticated` | lectura: `is_workspace_member`; reserva: server-trusted |
| `moka_debit_and_log(...)` | trigger / servicio | `service_role` SÓLO | server-trusted (NO `auth.uid()`) |
| `moka_settle(workspace_id, category, idempotency_key, real_cost_mc)` | servicio (post-pago) | `service_role` SÓLO | server-trusted |
| `moka_admin_grant / set_addon / set_tier / set_enforce / admin_revoke` | admin server action | `authenticated` | `IF NOT is_admin() THEN RAISE` |
| `moka_consumption(workspace_id)` (agregado para UI) | front | `authenticated` | `is_workspace_member` |

> **`moka_debit_and_log` / `moka_settle` NO usan `auth.uid()`** ni el membership-check de `apply_sale_payment`. En background/`after()`/cron `auth.uid()` es NULL → el WHERE no matchearía y el cobro se perdería. La autorización la da el hecho de poseer la service key. `REVOKE EXECUTE FROM authenticated, anon` en estas dos. El `workspace_id` lo provee el backend desde la fila de usage ya validada, no desde el JWT.

### 7.7 Resets (pg_cron, puro SQL, escriben ledger `kind='reset'`)

```sql
-- Diario a las 00:00 AR (= 03:00 UTC, alineado con los crons existentes y la promesa de la UI).
SELECT cron.schedule('moka-daily-reset','0 3 * * *', $$
  UPDATE public.moka_balances
  SET daily_spent_mc = 0, hold_mc = 0,
      day = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  WHERE day < (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$$);
-- Mensual día 1 00:00 AR.
SELECT cron.schedule('moka-monthly-reset','0 3 1 * *', $$
  UPDATE public.moka_balances
  SET monthly_spent_mc = 0,
      month = date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  WHERE month < date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$$);
```

> El cron es **backstop**, no fuente de correctitud: el reset real lo hace el **lazy-reset dentro del débito/precheck** (§8, §9). Re-schedule idempotente con `cron.unschedule(name) WHERE EXISTS(...)`.

---

## 8. Arquitectura de metering/débito

### 8.1 Modelo elegido: post-pago con HOLD pesimista en el pre-check + débito atómico en trigger

Tres momentos. El insight central (de las ideas injertadas y los hallazgos): **el único punto de instrumentación realmente único es el `AFTER INSERT` sobre las tablas de usage** — y NO `logLLMUsage`/`logIntegrationUsage`, porque hay inserts crudos (competitor scrape, edge function sync). Por eso el débito vive en un **trigger DB**, no en los call sites.

#### (1) PRE-CHECK con reserva (antes de ejecutar la operación cara)

`moka_precheck(workspace_id, category, hold_mc)` toma un **HOLD pesimista** con el patrón `apply_sale_payment` (UPDATE single-row, guard-in-WHERE, FOR UPDATE implícito):

```sql
UPDATE moka_balances
SET hold_mc = hold_mc + p_hold,
    daily_spent_mc = (CASE WHEN day < hoy_ar THEN 0 ELSE daily_spent_mc END),   -- lazy reset
    daily... , day = hoy_ar, month = mes_ar
WHERE workspace_id = p_ws AND category = p_cat
  AND (daily_spent_mc + hold_mc + p_hold) <= cap_diario_efectivo
  AND (monthly_spent_mc + hold_mc + p_hold) <= cap_mensual_efectivo
RETURNING *;
-- Si no matchea -> RETURNING vacío -> BLOCKED (402). N requests concurrentes se serializan
-- por el row-lock y el N+1 que cruza el límite se rechaza. Cierra el burst.
```

El `hold_mc` se dimensiona al **piso conservador de la acción completa** (conocido a-priori):
- chat complejo: piso ≈ 5–10 MC por iteración Sonnet (pre-check **por iteración**, ver §10).
- scrape competidor: piso scraping = `costo_profile + N*costo_reel`; piso IA = `N*costo_analisis_estimado` → **se pre-chequean AMBAS categorías** antes de arrancar el `after()`.
- operaciones baratas/cacheables (auto-title, hooks): **sin hold**, post-pago puro (ver §8.4).

#### (2) DÉBITO / SETTLE (post-pago, dentro del trigger AFTER INSERT)

```sql
CREATE TRIGGER trg_moka_debit_llm   AFTER INSERT ON public.llm_usage
  FOR EACH ROW EXECUTE FUNCTION public.moka_on_usage_insert();
CREATE TRIGGER trg_moka_debit_integ AFTER INSERT ON public.integration_usage
  FOR EACH ROW EXECUTE FUNCTION public.moka_on_usage_insert();
```

`moka_on_usage_insert()` (SECURITY DEFINER):
1. Deriva `category` de `moka_category_map` (`source`, `NEW.feature`/`NEW.operation`). Si `system` o `service` → NO debita (se reconcilia aparte, §13). Si `unmapped` → NO debita + log alerta.
2. `cost_mc = round(NEW.cost_usd * 100, 2)`. Si `NEW.cost_usd = 0` y el modelo NO está en allowlist de gratis → aplica **`min_settle_mc`** (piso por acción) y reason `'UNPRICED_MODEL:'||model` + alerta (ver §8.5).
3. **Lazy reset** de la fila (`CASE WHEN day < hoy THEN 0 ...`) en el mismo UPDATE.
4. `UPDATE moka_balances SET daily_spent_mc = ... + cost_mc, monthly_spent_mc = ... + cost_mc, hold_mc = GREATEST(0, hold_mc - p_hold_estimado)` (libera el hold y settlea lo real).
5. `INSERT INTO moka_ledger (..., usage_id = NEW.id, usage_source, idempotency_key = NEW.id::text, kind='debit')`. **El INSERT al ledger va PRIMERO**; si colisiona 23505 (retry del mismo `NEW.id`) → `EXCEPTION WHEN unique_violation THEN RETURN NEW` (idempotente, no doble-cobra y no toca el balance).

> **Por qué trigger y no call-site:** (a) captura los 4 call sites (helper, insert crudo de competitor, edge function sync, futuros) sin tocar ninguno; (b) **atomicidad gratis** — el débito ocurre en la MISMA transacción que el INSERT de usage: si la fila de usage commitea, el débito commitea; (c) `idempotency_key = usage_row.id` es trivialmente UNIQUE por PK (un evento = una fila = un débito); (d) los call sites siguen siendo fire-and-forget, sin latencia agregada en el path crítico.

#### (3) REFUND / ajuste

En post-pago, **"el LLM falló" = "no se cobró"** por construcción (sin fila de usage exitosa → sin trigger → sin débito). Por eso **NO hay `moka_refund` automático en el camino feliz** (sería código muerto que da falsa robustez). El refund se limita a:
- **Refund de costo NO incurrido:** sólo si el proveedor externo no cobró (Apify run abortado antes de consumir CU, LLM 4xx sin tokens). Se modela como fila de usage con `cost_usd` negativo / `status='refund'` que el mismo trigger debita en negativo.
- **Ajuste de atribución / admin:** `moka_admin_grant` (se debitó a la categoría/workspace equivocado).

> **Anti-explotación:** si el costo externo YA se incurrió (scrape Apify corrió, tokens consumidos), **NO se refunda** aunque el resultado no sirva al usuario — si no, el refund es un agujero para consumir gratis.

### 8.2 Atomicidad y concurrencia

| Riesgo | Mitigación |
|--------|------------|
| TOCTOU pre-check vs débito | Pre-check **reserva** (hold con guard-in-WHERE + FOR UPDATE). N requests serializan; el N+1 se rechaza. |
| Burst paralelo (script dispara N scrapes) | Mismo hold: la reserva del request N+1 no pasa el guard → BLOCKED. Overspend acotado de verdad, no O(requests). |
| Débito + INSERT usage no atómicos | **Trigger** = una sola transacción Postgres. No hay dos round-trips PostgREST. |
| Cron reset pisa débito en vuelo (lost charge) | **Lazy reset dentro del débito/precheck** (`CASE WHEN day < hoy`). El cron es backstop, no fuente de correctitud. |
| UPDATE balance + INSERT ledger divergen en retry | Ambos en la MISMA función plpgsql; INSERT ledger PRIMERO; `EXCEPTION WHEN unique_violation THEN RETURN`. |

### 8.3 Idempotencia

- **Clave determinística = `usage_row.id`** (la fila de usage ES el evento). Garantizada UNIQUE por PK. Un retry de Vercel que reinserta la misma fila colisiona; un evento genuinamente nuevo (otra iteración del tool loop) tiene otro `id` → se cobra correctamente.
- Esto resuelve el dilema del tool-loop: cada iteración del chat genera su propia fila `llm_usage` → su propio débito legítimo, sin colisionar ni subfacturar.
- Para acciones compuestas (scrape 5 reels), cada análisis genera su fila → su `id` → idempotencia por sub-evento sin necesidad de claves construidas a mano.

### 8.4 Operaciones cacheables (auto-title, hooks)

- Hoy cachean (`reel.auto_title`, `hook_classifications`) y NO loguean. Se instrumentan con `logLLMUsage` **SÓLO en cache-miss** (cuando hubo llamada LLM efectiva). Como el débito deriva de la fila de usage (que sólo se escribe en cache-miss), una operación cacheada cuesta 0 coins naturalmente.
- **Anti cache-miss farming:** estas operaciones baratas tienen, además del cap en coins, un **contador de ops/día** por feature (sub-cap), para que variar 1 char del input para forzar cache-miss no escale.

### 8.5 Modelos sin pricing (`cost_usd = 0`)

- **Bloqueante antes de enforcement:** completar `MODEL_PRICING` con `gemini-2.5-pro` (~$1.25 in / $10 out) y todo modelo de rescate; **mover `MODEL_PRICING` a DB** (fuente única que comparten metering y ledger).
- **Fail-closed en pricing:** si `cost_usd = 0` para un modelo conocido-caro (no en allowlist de gratis), el trigger debita un **`min_settle_mc`** conservador (piso por acción) + reason `'UNPRICED_MODEL'` + alerta admin. `cost_usd=0` **nunca** significa "gratis" para un modelo caro. Esto evita que el camino más caro de video (tier-up a pro/GPT-4o) sea gratis e ilimitado.

### 8.6 El único punto de integración

El **trigger `AFTER INSERT`** es el guard server-side único. Para el lado del **pre-check** (que sí necesita correr antes de la operación), se expone un helper único:

```ts
// src/lib/moka/guard.ts
export async function mokaPrecheck(
  client, workspaceId, category: 'ai'|'scraping', holdMc: number
): Promise<{ ok: boolean; remaining: number }>
```

Se llama en **1 línea** al inicio de las acciones caras (chat, gemini-analyze, scrape). Las acciones baratas no lo necesitan (post-pago puro). La verdad siempre la decide el RPC server-side; el front lo usa además para deshabilitar botones (UX optimista).

---

## 9. Límites diarios vs mensuales

- **Reset diario:** `0 3 * * *` UTC = **00:00 AR**. Coincide con la "medianoche" que promete la UI.
- **Reset mensual:** `0 3 1 * *` UTC = día 1, 00:00 AR.
- **Huso horario elegido:** **`America/Argentina/Buenos_Aires`**, hardcodeado en v1 (Arko es AR-centric; los crons existentes ya están calibrados a AR). El "día de negocio" se calcula con `(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date` tanto en débito, precheck, reset y la barra — consistente. Si en el futuro hay workspaces en otro huso → agregar `workspaces.timezone` y parametrizar.
- **Por qué AR y no UTC:** con UTC un workspace argentino vería la barra renovarse a las 21:00 hora local (UTC-3), contradiciendo el copy "se renueva a medianoche".
- **Reset correcto-por-construcción:** lazy reset dentro del débito/precheck; el cron es backstop.
- **Rollover: NO.** Lo no usado se pierde a medianoche (diario) y el día 1 (mensual). Explícito en docs y en la barra (tooltip) para que el cliente no reclame coins "desaparecidos".

---

## 10. Integración en los call sites existentes

Superficie mínima: el **débito es automático vía trigger**. Sólo el **pre-check con hold** y el **hint pre-acción** se agregan, y sólo en las acciones caras.

| Call site | Dónde se mete el guard | Notas |
|-----------|------------------------|-------|
| **Chat complejo** `chat/route.ts` (path complex) | `moka_precheck('ai', ~5–10 MC)` **POR ITERACIÓN** dentro del tool loop, antes de cada `callLLMWithResilience`. Si BLOCKED → cortar el loop limpiamente, emitir SSE `limit_reached`, terminar con lo acumulado. | Convierte el overspend de "150 MC/mensaje" en "≤1 iteración (~5–30 MC)". El débito de cada iteración lo hace el trigger sobre su fila `llm_usage`. Hint pre-mensaje: "Esta consulta puede usar ~X Moka". |
| **Chat simple** `chat/route.ts` (path simple) | `moka_precheck('ai', ~0.5 MC)` 1 vez. | Barato; sin hint. |
| **Onboarding ADN** `onboarding/chat/route.ts` | `moka_precheck('ai', ~0.2 MC)` 1 vez. | 2 inserts/mensaje (call + follow-up) → 2 débitos por trigger, cada uno con su `id`. |
| **gemini-analyze** `reels/[id]/gemini-analyze/route.ts` | `moka_precheck('ai', ~5 MC)` antes; hint si tier-up probable. | El tier-up a pro/GPT-4o lo cubre el fail-closed de pricing (§8.5). |
| **Competidor** `competitors/[id]/scrape/route.ts` | **Carga base / refresh programado** → estampa `operation='competitor-base-load'`/`'-scheduled-refresh'` → `service`, **NO debita** (cap de reels estructural §4.4). **Re-scrape manual** → `'competitor-manual-rescrape'` → `moka_precheck('scraping', piso)` y debita. **Análisis IA** (top-5) → `moka_precheck('ai')` aparte. | El `after()` usa **`createServiceClient()`** (service-role). El análisis Gemini en background hace su **propio `moka_precheck('ai')`** y se auto-cancela ("pendiente por límite") si IA está agotada. Hint solo en acciones on-demand. |
| **Referencia** `references/[id]/scrape/route.ts` | **Carga base / refresh** → `service` (NO debita). **Re-scrape manual** → `'reference-manual-rescrape'` → `moka_precheck('scraping')` y debita. **Instrumentar `logIntegrationUsage`** (hoy invisible) ANTES de activar el cap. | Sin instrumentar, el scrape no se contabiliza. |
| **Auto-título / hooks** | Sin pre-check (post-pago puro). **Instrumentar `logLLMUsage` en cache-miss**. Sub-cap de ops/día. | Cierra el punto ciego de costo invisible. |
| **Cron sync / enrichment** (edge function) | **Categoría `system` → NO debita** al workspace. | Reconciliado aparte en admin. |

**Gaps de instrumentación a cerrar ANTES de activar enforcement** (sin esto el cobro es injusto/invisible): `reel-auto-title`, `hooks/classify`, `competitor-grid-scrape`, `reference-scrape`, y completar `MODEL_PRICING` (gemini-2.5-pro + rescates).

---

## 11. Panel de admin

Bajo `src/app/(admin)`, reusando patrones existentes (defense-in-depth: middleware + layout + RLS `is_admin()`).

### 11.1 Vistas

- **`/admin/clients/[id]`** — control inline (tipo `ClientLanguagePicker`): dos barras de saldo (IA/Scraping, día y mes), botones de acción de admin.
- **`/admin/coins`** (nueva tab opcional en `AdminSidebar.navItems`): ledger global, balances de todos los workspaces, panel de reconciliación (§13).

### 11.2 Acciones (server actions `'use server'` + re-check `role==='admin'` IN-action + `revalidatePath`)

| Acción | RPC | Efecto |
|--------|-----|--------|
| Acreditar Moka Coins (one-off) | `moka_admin_grant` | Reduce `*_spent` del contador que bloquea (día/mes), con tope razonable. |
| +Tope (add-on persistente) | `moka_set_addon` | Sube `addon_daily_mc`/`addon_monthly_mc`. |
| Cambiar tier | `moka_set_tier` | trial → paid / expired. |
| Toggle enforcement | `moka_set_enforce` | `settings.moka_enforce` soft ↔ hard, por workspace. |
| Revocar grant/addon | `moka_admin_revoke` | Inversa segura clampeada (§6.3). |
| Editar allotments globales | UPDATE `moka_plan_allotments` | Alto impacto (todos los workspaces del tier). Usa `max(cap_nuevo, spent_ciclo)` durante el ciclo en curso. |

### 11.3 Auditoría

- Toda acción de admin escribe fila `moka_ledger` con `user_id` (admin), `kind`, `amount_mc`, `reason`, `created_at`. El ledger es append-only e inmutable → trazabilidad de quién acreditó/revocó qué, cuándo y por qué.

---

## 12. Edge cases y manejo

> Cobertura de TODOS los hallazgos adversariales.

| # | Caso | Manejo |
|---|------|--------|
| 1 | **Pre-check + débito no atómicos; overspend O(requests concurrentes), no O(1)** | Pre-check **reserva un HOLD** (UPDATE single-row guard-in-WHERE, FOR UPDATE). N requests se serializan; el que cruza el límite se rechaza. Backstop CHECK acota el techo. |
| 2 | **Burst paralelo (30 scrapes simultáneos) rompe el target diario** | Hold pesimista en el pre-check: la reserva del request N+1 no pasa el guard. Sin reserva el sistema era trivialmente vulnerable. |
| 3 | **idempotency_key del tool-loop (5 iteraciones legítimas vs retry)** | Clave = `usage_row.id`. Cada iteración = una fila `llm_usage` = un `id` distinto → 5 débitos legítimos. Un retry que reinserta la misma fila colisiona 23505. No subfactura ni doble-cobra. |
| 4 | **moka_debit no atómico con INSERT usage ("transacción lógica" inexistente en PostgREST)** | **Trigger AFTER INSERT** = una transacción Postgres real. Usage + ledger + balance todo-o-nada. |
| 5 | **Refund estructuralmente imposible en post-pago** | Se **elimina** `moka_refund` del camino feliz. "LLM falló" = "no hubo fila de usage" = "no se cobró". Refund sólo para costo NO incurrido (Apify abortado, LLM 4xx) y ajustes de admin. |
| 6 | **fire-and-forget → write garantizado rompe latencia/UX del chat** | El débito vive en el trigger (misma tx del insert), no en línea. Los call sites siguen fire-and-forget. Si el insert de usage falla, no hay cargo (consistente). Para el INSERT crudo que pueda fallar fuera de tx, `moka_debit_dlq` (outbox) reprocesada por cron. |
| 7 | **Reset cron pisa débito en vuelo (lost update inverso)** | **Lazy reset dentro del débito/precheck** (`CASE WHEN day < hoy THEN 0 ...` en el mismo UPDATE). El cron es backstop. |
| 8 | **23505 del ledger debe abortar también el UPDATE del balance** | Misma función plpgsql; INSERT ledger PRIMERO; `EXCEPTION WHEN unique_violation THEN RETURN`. |
| 9 | **Carrera cruzada IA/Scraping en scrape de competidor (acción compuesta)** | Pre-check de AMBAS categorías antes del `after()`. El análisis Gemini en background hace su propio `moka_precheck('ai')` y se auto-cancela si IA está agotada (estado "pendiente por límite"). |
| 10 | **cost_usd=0 (gemini-2.5-pro, rescate GPT-4o) = IA cara gratis e ilimitada** | Completar `MODEL_PRICING` (→ DB) + fail-closed: `min_settle_mc` por acción + alerta. `cost_usd=0` nunca = gratis para modelo caro. |
| 11 | **Doble cota no impide quemar el mes si el diario es perforable** | Resuelto por el hold (caso 1/2). Guard chequea diario Y mensual en el mismo statement. Cap horario suave anti-burst opcional para scraping. |
| 12 | **Pricing Apify estimado/hardcodeado → peg inexacto** | **Pricing real medido** (captura del dueño: ~$0.0083/reel, ~$0.0025/post, profile ~gratis) → markup chico ~1.1x. Seguir reconciliando `OPERATION_PRICING` vs billing real Apify (CU por run). Instrumentar grid + referencias ANTES de activar el cap. |
| 13 | **Refund explotable (matar conexión tras correr el scrape)** | Refund SÓLO si el proveedor no cobró. Costo ya incurrido → no se refunda. |
| 14 | **Reset "medianoche" vs huso horario (crons en UTC)** | `0 3 * * *` UTC = 00:00 AR; día calculado en `America/Argentina/Buenos_Aires`. Consistente con la UI. |
| 15 | **Chat SSE: pre-check único no acota; no se puede abortar a mitad de stream** | Pre-check **por iteración** + SSE `limit_reached` + terminar con lo acumulado (mejor UX que cortar en seco). |
| 16 | **Trial vence → caps "pasan a pago" = sube límites del gratis** | `moka_tier` desacoplado de `plan='pro'`. Trial vencido → `expired` (**0 = bloqueo**, override-able por admin), NUNCA `paid`. `paid` sólo por acción de admin. |
| 17 | **Cron de reset no recalcula tier/caps (stale)** | Caps **no cacheados**: se resuelven en vivo en cada precheck vía JOIN a `moka_plan_allotments` por tier calculado. |
| 18 | **Rollover ambiguo; grant diario inútil si el bloqueo es mensual** | `moka_admin_grant` acredita contra el contador que bloquea (día, mes o ambos), restando del `*_spent`. UI indica si el bloqueo es diario o mensual. NO rollover (explícito). |
| 19 | **Bajar allotment a mitad de ciclo bloquea retroactivo** | `max(cap_nuevo, spent_ciclo)` durante el ciclo; el cap nuevo rige desde el próximo reset. UI clampea spent/cap. Cambios por-workspace via addon, no allotment global. |
| 20 | **handle_new_user: cuentas sin trial quedan con caps NULL → fail-open** | SIEMPRE crear 2 filas `moka_balances`. Caps NOT NULL DEFAULT 0. Pre-check **fail-CLOSED** si no encuentra fila. Backfill de los 18 workspaces. Cuenta admin → tier `admin` (ilimitado). |
| 21 | **after()/background debita IA sin pre-check de IA** | Pre-check de IA al encolar; background hace su propio `moka_precheck('ai')`; fail-closed (no gasta si agotado), deja reels "pendiente por límite". |
| 22 | **idempotency_key no existe en call sites hoy** | Clave = `usage_row.id` (PK, ya garantizada UNIQUE), generada por DB. No requiere construir claves a mano. Sweeper cubre el resto. |
| 23 | **moka_debit con membership-check (auth.uid()) falla en service-role/background** | `moka_debit_and_log`/`moka_settle` NO usan `auth.uid()`; `GRANT EXECUTE TO service_role` SÓLO; `workspace_id` server-trusted. NO copiar el membership-check de `apply_sale_payment`. |
| 24 | **moka_admin_grant: gate is_admin() falla con service-role / inseguro sin gate** | Gate explícito `IF NOT is_admin() THEN RAISE`; `GRANT EXECUTE TO authenticated`; invocar con cliente RLS-respecting (JWT del admin). Tope razonable en `p_amount`. Re-check role en la action (defensa en profundidad). |
| 25 | **SELECT (member OR admin) sobre ledger filtra info comercial a viewer/member** | `moka_ledger` SELECT sólo `is_admin()` (+ owner-only para debit/refund). `moka_balances` sí member (sólo números). |
| 26 | **Revocar grant/addon: doble cobro o saldo negativo no auditado** | `moka_admin_revoke` clampea `min(grant, cap - spent)`, nunca re-cobra consumo pasado, `kind='admin_revoke'` + `revokes` UNIQUE. |
| 27 | **pg_cron reset corre sin auth.uid(); user_id NOT NULL rompería el reset** | `moka_ledger.user_id` NULL-able; reset es UPDATE+INSERT puro-SQL (no pasa por `is_admin()`), `user_id=NULL`, `kind='reset'`. |
| 28 | **stale-day: débito acumula sobre día viejo si cron no corrió** | Lazy reset dentro del débito/precheck (caso 7/14). |
| 29 | **Replicar policy INSERT de llm_usage → auto-crédito** | NO copiar. Cero policies INSERT/UPDATE/DELETE para authenticated. Assert en la migración. |
| 30 | **"Único punto de instrumentación" FALSO (inserts crudos: competitor scrape, edge sync)** | Por eso el débito es **trigger AFTER INSERT**, no `logLLMUsage`. Captura helper + inserts crudos + futuros. |
| 31 | **Costo de cron/sistema debita al usuario por acciones que no disparó** | Categoría `system` → NO debita la billetera del workspace. Reconciliado aparte. |
| 32 | **Workspace eliminado** | `ON DELETE CASCADE` limpia balances + ledger junto con `llm_usage`/`integration_usage`. |
| 33 | **Cancelar/reintentar chat re-cobra iteraciones ya ejecutadas** | Iteraciones ejecutadas se cobran (costo real). Cachear resultados parciales por `session_id`; ofrecer reanudar sin re-pagar. Rate-limit de reintentos por `session_id`+ventana corta. |
| 34 | **after() background muere tras correr la op pero antes del débito (under-charge)** | **Sweeper de reconciliación** (cron): diffea filas `llm_usage`/`integration_usage` (por `id`) sin fila `moka_ledger` matcheada y back-charge. Cierra el espejo del stranded-state. |

---

## 13. Observabilidad y alertas

| Señal | Mecanismo |
|-------|-----------|
| **Workspace en 0 (categoría agotada)** | Cuando el débito deja `daily_spent >= daily_cap`, el trigger inserta `kind='depleted'` y dispara `net.http_post` (patrón `trigger_scheduled_sync` ya existente + vault/pg_net) a una edge function que manda email/Slack al admin. |
| **Trial soft-gate quemando 5x su cap** | Job diario que lista workspaces con `spent > cap` en modo visibilidad (enforcement off) para revisar abuso. |
| **Divergencia costo real vs estimado (Apify/LLM)** | Panel en `/admin/coins`: suma mensual `integration_usage.cost_usd` por provider vs campo manual de factura real (Apify/Anthropic/Google), con % de divergencia y alerta si > umbral (ej. 20%). Registrar `run_id`/CU real en `metadata` cuando Apify lo devuelva, para reconciliar item por item. |
| **Drift del ledger (debit vs usage)** | Job mensual de reconciliación: `SUM(usage.cost_usd)*100` vs `SUM(ledger.amount_mc)` por workspace. Detecta under/over-charge. Alimenta la recalibración del catálogo (>25% → revisar pricing). |
| **Cargo huérfano (usage sin débito)** | **Sweeper** (cron horario): back-charge automático de filas de usage sin débito pasado el umbral (1h). |
| **Modelo no priceado** | Reason `'UNPRICED_MODEL'` en ledger + alerta admin (no silencioso). |
| **Operación no mapeada** | Categoría `unmapped` + alerta admin para que la mapee. |

---

## 14. Plan de implementación por fases

> DB primero, código después. Cada fase entregable y testeable. **Target = Prod (`zphvrohosizkbrnxtppj`)** por decisión explícita del dueño (override de la regla Dev-first de CLAUDE.md §5, igual que F2.5-5). Aplicar migraciones **de a una y verificando**; nada destructivo sobre los datos existentes (los 18 workspaces). Backfill de balances idempotente.

### Fase 0 — Cerrar gaps de instrumentación (pre-requisito, sin enforcement)
- Agregar `logLLMUsage` a `reel-auto-title` (cache-miss) y `hooks/classify`.
- Agregar `logIntegrationUsage` al `competitor-grid-scrape` y a TODO el scrape de referencias.
- Completar `MODEL_PRICING` (gemini-2.5-pro + rescates) y **moverlo a DB** (fuente única).
- **Entregable:** 100% del costo externo logueado. **Test:** toda acción del recon produce fila de usage con `cost_usd > 0` (o `min_settle` con alerta).

### Fase 1 — Esquema + seeds (DB)
- Migración: `moka_plan_allotments`, `moka_category_map`, `moka_balances`, `moka_ledger` + índices + RLS (sin policies INSERT) + backstop CHECK + assert anti-INSERT-policy.
- Seeds: allotments (trial/paid/expired/admin), category_map exhaustivo (grep de strings reales).
- **Entregable:** tablas vacías correctas. **Test:** RLS niega INSERT a authenticated; SELECT de balances OK para member, ledger sólo admin.

### Fase 2 — RPCs + trigger + lazy reset (DB)
- `moka_precheck`, `moka_debit_and_log`/`moka_on_usage_insert` (trigger), `moka_settle`, lazy reset, fail-closed pricing, `min_settle_mc`.
- GRANTs estrictos (debit/settle → service_role; admin RPCs → authenticated con gate).
- **Test:** débito atómico, idempotencia (23505), concurrencia (2 debitos serializan), lazy reset en cambio de día.

### Fase 3 — Stamping + backfill (DB)
- Extender `handle_new_user()` para crear 2 filas `moka_balances` siempre, resolviendo tier.
- Backfill de los 18 workspaces existentes (incluida cuenta admin → tier admin).
- **Test:** workspace nuevo arranca con balances; cuenta sin trial → tier expired/cortesía, nunca paid; admin ilimitado.

### Fase 4 — Crons (DB)
- `moka-daily-reset`, `moka-monthly-reset` (escriben `kind='reset'`, user_id NULL), sweeper de reconciliación, job de drift, alerta `depleted`.
- **Test:** reset a 00:00 AR; sweeper back-charge un usage sin débito; alerta dispara.

### Fase 5 — Guard server-side + pre-checks en call sites (código)
- `src/lib/moka/guard.ts` (`mokaPrecheck`). Enganchar pre-check (1 línea) en chat (por iteración), gemini-analyze, scrape competidor (ambas categorías, síncrono antes del `after()`, service-role en background), scrape referencia.
- **Test:** burst de N requests → sólo pasan los que caben; chat corta loop en `limit_reached`; scrape no sobregira IA.

### Fase 6 — UI usuario (código)
- Dos barras (IA/Scraping, día + tooltip mensual), botones deshabilitados con copy claro, hint pre-acción en operaciones caras. `moka_consumption` RPC.
- **Test:** barra refleja saldo; botón se deshabilita al agotar; reset a medianoche AR repone.

### Fase 7 — Admin (código)
- `/admin/clients/[id]` controles inline + server actions (grant, addon, set_tier, set_enforce, revoke). `/admin/coins` (ledger + reconciliación + divergencia).
- **Test:** admin acredita/revoca con auditoría; cliente no puede auto-acreditarse (RLS); reconciliación muestra divergencia.

### Fase 8 — Activar enforcement gradual
- Arranca **soft (visibilidad)** por workspace (`settings.moka_enforce=false`), igual que trials v1. Calibrar con datos reales (sweeper, drift, divergencia Apify). Encender hard-gate por workspace cuando los holds estén bien calibrados.
- **Test:** soft = registra sin bloquear; hard = bloquea con 402 + copy.

---

## 15. Decisiones abiertas para el dueño

> Estado al 2026-06-22. Las 5 principales quedaron **lockeadas por el dueño**; las demás se resolvieron con la recomendación.

### Resueltas

1. ✅ **Target Supabase:** **Prod** (`zphvrohosizkbrnxtppj`) — override explícito del dueño a Dev-first (CLAUDE.md §5).
2. ✅ **Trial vencido:** **bloqueo total (caps 0)**; todo override-able por workspace desde admin (extender/aplazar/acreditar).
3. ✅ **Caps:** Trial 50/1500 · Pago 150/4500 por categoría (diario/mensual). $0.50/día y $1.50/día.
4. ✅ **Modelo de metering:** **Servicio gratis + on-demand paga** (§3.4); costo de servicio acotado por límites estructurales (§4.4).
5. ✅ **Pricing Apify:** real medido (~$0.0083/reel, ~$0.0025/post, profile ~gratis); markup ~1.1x (ya no 1.5x).
6. ✅ **Enforcement:** arranca **soft** (visibilidad); hard-gate por workspace tras calibrar; toggle-able desde admin.
7. ✅ **Ledger del owner:** el usuario ve **solo las dos barras**; ledger detallado solo admin.
8. ✅ **Cuenta admin:** **ilimitada pero logueada** (para reconciliación).
9. ✅ **Add-ons al invitar:** **no en v1**; el admin acredita/configura post-registro.
10. ✅ **Alertas:** **email al admin** en v1 (reusar `net.http_post` + edge function); Slack opcional después.

### Abiertas (a calibrar — no bloquean el arranque)

- **A. Números de los límites estructurales (§4.4):** competidores/referencias por capa, frecuencia de refresh, reels por carga base y por re-scrape manual. Arrancar con los ejemplos y ajustar con datos reales.
- **B. Cadencia del refresh programado** (lo absorbemos como servicio): definir frecuencia que no dispare el costo Apify de fondo (ej. semanal en trial, cada 3 días en pago).
- **C. ¿Cap horario suave anti-burst para scraping** además del diario/mensual? Default: no en v1 (el hold + doble cota alcanza; patrón esperado 1–2 scrapes/día).
