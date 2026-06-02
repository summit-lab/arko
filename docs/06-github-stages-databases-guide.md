# Guia Maestra de GitHub, Ambientes y Deploy — Arko

> Este documento explica, en lenguaje simple, como funciona TODO el sistema de Arko.
> Esta pensado para humanos y para asistentes de IA.
> **ANTES de tocar ramas, PRs, deploy, Supabase o migraciones, leer esta guia.**

---

## 1. Diagrama completo del sistema

```
 TU COMPUTADORA (local)                    GITHUB                         VERCEL + SUPABASE
 ========================                  ========                       ==================

 .env.local                               Ramas:
 APP_ENV=local                            ┌─────────────┐
 Supabase → Dev Arko                      │ feature/*   │
                                          │ fix/*       │──push──→ (no deploy)
   │                                      │ docs/*      │
   │                                      │ chore/*     │
   │  commit + push                       └──────┬──────┘
   │                                             │
   │                                        PR a develop
   │                                             │
   ▼                                             ▼
                                          ┌─────────────┐        ┌─────────────────────┐
                                          │   develop    │──auto──│  Vercel PREVIEW      │
                                          │             │  deploy│  URL: arko-git-       │
                                          │ (staging)   │───────→│  develop-*.vercel.app │
                                          └──────┬──────┘        │  Supabase: Dev Arko   │
                                                 │               │  (hrsvglgswatwklivkoyp)│
                                            PR a main            └─────────────────────┘
                                          (SOLO MANUAL,
                                           humano decide)
                                                 │
                                                 ▼
                                          ┌─────────────┐        ┌─────────────────────┐
                                          │    main      │──auto──│  Vercel PRODUCTION   │
                                          │             │  deploy│  URL: arko-bay.       │
                                          │ (produccion)│───────→│      vercel.app       │
                                          └─────────────┘        │  Supabase: Prod Arko  │
                                                                 │  (zphvrohosizkbrnxtppj)│
                                                                 └─────────────────────┘
```

---

## 2. Las 5 reglas de oro

### Regla 1: NUNCA pushear directo a `main`

`main` es produccion. Hay personas reales usandola todos los dias.
El unico camino a `main` es un **Pull Request desde `develop`**, revisado y mergeado **manualmente por un humano**.

**Ni la IA ni ningun developer deberian pushear directo a `main`. Jamas.**

### Regla 2: Todo cambio va primero a `develop`

El flujo siempre es:
```
tu rama → PR a develop → probar en staging → PR a main → produccion
```

### Regla 3: Dos bases de datos separadas, siempre

| Supabase | ID del proyecto | Uso |
|----------|----------------|-----|
| **Dev Arko** | `hrsvglgswatwklivkoyp` | local + staging (develop) |
| **Prod Arko** | `zphvrohosizkbrnxtppj` | produccion (main) |

Nunca mezclarlas. Nunca apuntar local a Prod.

### Regla 4: Los cambios de DB se mueven con migraciones

No editar tablas a mano en produccion. El flujo es:
1. Crear migracion SQL
2. Aplicar en Dev Arko
3. Probar
4. Aplicar en Prod Arko solo cuando se hace release

### Regla 5: La IA no toca produccion sin orden explicita

- Durante desarrollo: la IA solo lee Prod (SELECT)
- Solo en release explicito: la IA puede aplicar migraciones en Prod

---

## 3. Ambientes — que es cada uno

### 3.1 Local (tu computadora)

```
APP_ENV=local
NEXT_PUBLIC_APP_URL=http://localhost:3000
Supabase → Dev Arko
```

- Donde programas y probas rapido
- Apunta a Dev Arko (nunca a Prod)
- Los cambios no afectan a nadie

### 3.2 Staging (Vercel Preview)

```
APP_ENV=staging
NEXT_PUBLIC_APP_URL=(URL de preview de Vercel)
Supabase → Dev Arko
```

- Se deploya automaticamente cuando se pushea a `develop`
- Usa la misma DB que local (Dev Arko)
- Sirve para validar que todo funcione en un servidor real antes de produccion
- URL: la que Vercel asigna al preview de develop

### 3.3 Produccion (Vercel Production)

```
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://www.usemoka.io
Supabase → Prod Arko
```

- Se deploya automaticamente cuando se mergea un PR a `main`
- Usa Prod Arko — datos reales, usuarios reales
- **Solo se actualiza via PR desde develop, nunca directo**

---

## 4. Flujo de trabajo paso a paso

### 4.1 Desarrollo normal (sin DB)

```
1. En GitHub Desktop: crear rama desde develop (ej: feature/mi-cambio)
2. Trabajar con la IA en el codigo
3. Probar localmente (localhost:3000)
4. La IA sugiere commit message
5. En GitHub Desktop: commit + push
6. En GitHub: abrir PR hacia develop
7. CI corre automaticamente (lint + typecheck + build)
8. Si CI pasa → mergear PR a develop
9. Vercel deploya Preview automaticamente
10. Probar en staging (URL de Preview)
```

### 4.2 Pasar a produccion

```
11. En GitHub: abrir PR de develop → main
12. CI corre automaticamente
13. Si CI pasa → UN HUMANO mergea (nunca la IA)
14. Vercel deploya Production automaticamente
15. Verificar en www.usemoka.io
```

### 4.3 Desarrollo con cambios de DB

```
1-5. Igual que arriba
6. Ademas: crear migracion SQL
7. Aplicar migracion en Dev Arko (via MCP o Supabase Dashboard)
8. Probar localmente
9. Push + PR a develop
10. Validar en staging
11. Cuando se apruebe release: aplicar misma migracion en Prod Arko
12. Actualizar docs/DB_SCHEMA.md
```

---

## 5. Que hace cada herramienta

### GitHub Desktop (lo usa el developer)
- Crear ramas
- Ver archivos modificados
- Hacer commits
- Push
- Cambiar de rama

### GitHub Web (lo usa el developer)
- Abrir Pull Requests
- Revisar CI checks
- Mergear PRs
- **Mergear a main** (esto es siempre manual)

### IA (Claude, Windsurf, etc)
- Escribir codigo
- Sugerir nombre de rama, commit message, descripcion de PR
- Actualizar documentacion y changelog
- Consultar DB via MCP (solo lectura en Prod)
- Aplicar migraciones en Dev Arko

### Lo que la IA NUNCA debe hacer
- Pushear directo a `main`
- Sugerir pushear a `main`
- Mergear PRs a `main`
- Escribir en Prod Arko durante desarrollo
- Ejecutar comandos destructivos en git sin confirmacion

---

## 6. Vercel — como esta configurado

### Ambientes en Vercel

| Ambiente Vercel | Rama | Supabase | URL |
|----------------|------|----------|-----|
| **Preview** | `develop` (y cualquier otra rama) | Dev Arko | `arko-git-develop-*.vercel.app` |
| **Production** | `main` | Prod Arko | `www.usemoka.io` |

### Variables de entorno en Vercel

Las variables estan separadas por ambiente:
- **Preview**: apunta a Dev Arko, APP_ENV=staging
- **Production**: apunta a Prod Arko, APP_ENV=production

Si se agrega una variable nueva al proyecto:
1. Agregarla en `.env.example`
2. Agregarla en `src/lib/env.ts`
3. Agregarla en Vercel para Preview Y Production
4. Actualizar `docs/05-environments-guide.md`

---

## 7. Supabase Edge Functions

El sync de Instagram corre en Supabase Edge Functions (gratis, no en Vercel).

### Como funciona

```
Usuario clickea "Sync" en el dashboard
        │
        ▼
Next.js route (thin proxy, ~1s)
  - Autentica al usuario
  - Invoca Edge Function via supabase.functions.invoke()
        │
        ▼
Supabase Edge Function "sync-instagram" (gratis, hasta 500K/mes)
  - Sync de reels + insights
  - Sync de ads
  - Sync de account insights
  - Refresh de benchmarks
```

### Edge Functions deployadas

| Proyecto | Funcion | Secretos configurados |
|----------|---------|----------------------|
| Dev Arko | `sync-instagram` | SYNC_SECRET, META_APP_ID, META_APP_SECRET, etc. |
| Prod Arko | `sync-instagram` | SYNC_SECRET, META_APP_ID, META_APP_SECRET, etc. |

---

## 8. CI/CD — GitHub Actions

Archivo: `.github/workflows/ci.yml`

Corre automaticamente en cada push y PR a `develop` o `main`.

### Pasos
1. `npm ci` — instala dependencias
2. `npm run lint` — verifica codigo
3. `npx tsc --noEmit` — verifica tipos
4. `npm run build` — verifica que compila

Si cualquier paso falla, el PR se marca con X roja.
No mergear PRs con checks rojos.

---

## 9. Reglas para la IA (resumen ejecutivo)

### Siempre

- Push va a `develop`, NUNCA a `main`
- Leer esta guia antes de tocar ramas, deploy o DB
- Sugerir nombre de rama, commit message y descripcion de PR
- Actualizar docs y changelog despues de cada cambio
- Usar migraciones para cambios de DB

### Nunca

- Pushear a `main`
- Sugerir mergear a `main` sin que el humano lo decida
- Tocar Prod Arko durante desarrollo
- Ejecutar `git push --force` o `git reset --hard` sin confirmacion
- Hacer deploy sin validacion explicita

### Cuando el humano pide "pasalo a produccion"

1. Verificar que develop esta estable
2. Verificar que staging funciona
3. Sugerir abrir PR de `develop` → `main`
4. El humano mergea manualmente
5. Si hay migraciones de DB: aplicarlas en Prod Arko despues del merge

---

## 10. Checklist rapido

### Antes de pushear
- [ ] Estoy en una rama propia (no develop, no main)
- [ ] El codigo compila localmente
- [ ] El commit message es descriptivo

### Antes de mergear a develop
- [ ] CI esta en verde
- [ ] Los cambios estan documentados
- [ ] Changelog actualizado

### Antes de mergear a main
- [ ] Staging fue probado y funciona
- [ ] No hay cambios de DB pendientes de aplicar
- [ ] Un humano tomo la decision de publicar

---

## 11. Archivos relacionados

| Archivo | Tema |
|---------|------|
| `CLAUDE.md` | Reglas generales para la IA |
| `docs/05-environments-guide.md` | Variables de entorno |
| `docs/04-deployment.md` | Deploy |
| `docs/03-security.md` | Seguridad |
| `docs/DB_SCHEMA.md` | Schema de la base de datos |
| `docs/07-mcp-guide.md` | MCP y acceso a Supabase |
| `.github/workflows/ci.yml` | CI/CD |
| `src/lib/env.ts` | Validacion de variables |
| `.env.example` | Template de variables |
