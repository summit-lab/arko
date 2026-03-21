# Guía de Ambientes — Arko

> Esta guía explica cómo funcionan los ambientes del proyecto paso a paso.
> Está pensada para personas que no necesariamente entienden de infraestructura.
> Si usás Windsurf, Claude Code u otra IA, esta guía también le sirve a ella.

---

## ¿Qué es un "ambiente"?

Un ambiente es una copia separada del proyecto que se usa para un propósito distinto.

Pensalo como:

- **local** → tu computadora. Donde construís y probás cosas.
- **staging** → un servidor de prueba. Donde verificás que todo funcione antes de publicar.
- **production** → el servidor real. Donde viven los usuarios finales.

Cada ambiente tiene sus propias variables (claves, URLs, base de datos).
El código es el mismo en los tres; lo que cambia son las variables.

---

## ¿Por qué importa?

Sin ambientes separados, pasan cosas como:

- Usás la base de datos de producción mientras desarrollás y borrás datos reales.
- Dejás `http://localhost:3000` metido en el código y cuando se sube a producción, se rompe.
- Meta OAuth intenta redirigir a `localhost` en vez de a la URL real.

Con ambientes bien configurados, eso no puede pasar.

---

## ¿Cómo funciona en Arko?

### 1. Cada ambiente tiene su propio `.env.local`

Cuando clonás el proyecto y hacés `Copy-Item .env.example .env.local`, estás creando la configuración para **tu ambiente local**.

Ese archivo tiene las variables que le dicen al proyecto:

- **en qué ambiente estoy** (`APP_ENV`)
- **cuál es mi URL base** (`NEXT_PUBLIC_APP_URL`)
- **a qué Supabase me conecto**
- **qué claves de proveedor uso**

### 2. El código no sabe en qué ambiente está

El código nunca dice `if localhost then...`. En cambio, lee las variables y se adapta solo.

Por ejemplo, el callback de Meta OAuth se arma así internamente:

```
NEXT_PUBLIC_APP_URL + /api/v1/auth/meta/callback
```

Si estás en local, resulta:
```
http://localhost:3000/api/v1/auth/meta/callback
```

Si estás en staging, resulta:
```
https://staging.arko.app/api/v1/auth/meta/callback
```

Si estás en producción, resulta:
```
https://app.arko.app/api/v1/auth/meta/callback
```

Nadie tiene que cambiar código. Solo cambian las variables.

---

## ¿Qué variables necesito configurar?

### Obligatorias (siempre)

| Variable | Qué es | Ejemplo en local |
|---|---|---|
| `APP_ENV` | En qué ambiente estás | `local` |
| `NEXT_PUBLIC_APP_URL` | URL pública de tu app | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de Supabase (solo server) | `eyJhbGci...` |

### Opcionales (según lo que estés trabajando)

| Variable | Cuándo la necesitás |
|---|---|
| `META_APP_ID` | Si trabajás con Instagram o Meta Ads |
| `META_APP_SECRET` | Si trabajás con Instagram o Meta Ads |
| `META_TOKENS_ENCRYPTION_KEY` | Si trabajás con Instagram o Meta Ads |
| `OPENAI_API_KEY` | Si trabajás con análisis IA (GPT-4) |
| `GEMINI_API_KEY` | Si trabajás con análisis de video (Gemini) |
| `APIFY_API_TOKEN` | Si trabajás con enriquecimiento de Reels |
| `YOUTUBE_API_KEY` | Si trabajás con YouTube Intelligence |

Si no estás trabajando en esa feature, no necesitás esa variable.
La app arranca igual sin las opcionales.

---

## Paso a paso: configurar tu ambiente local

### 1. Clonar el repo

```bash
git clone https://github.com/summit-lab/arko.git
cd arko
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear tu archivo de variables

```powershell
Copy-Item .env.example .env.local
```

### 4. Completar las variables

Abrí `.env.local` y completá los valores reales.

Las obligatorias son:

- `APP_ENV=local`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- las 3 de Supabase (URL, anon key, service role key)

El resto depende de qué feature vas a trabajar.

### 5. Levantar el proyecto

```bash
npm run dev
```

### 6. Verificar

- Abrí `http://localhost:3000`
- Si la app arranca sin errores → tu ambiente está bien
- Si hay error de variables → revisá la consola, te dice cuál falta

---

## Paso a paso: cómo sería staging

Staging es igual que local pero en un servidor remoto (por ejemplo, un deploy de Vercel apuntando a `develop`).

En staging, las variables serían algo así:

```
APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.arko.app
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Esas variables se configuran en el panel de Vercel (o el proveedor que uses), no en un archivo local.

---

## Paso a paso: cómo sería producción

Producción es el ambiente real. Solo se llega ahí cuando `main` está estable.

```
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://app.arko.app
NEXT_PUBLIC_SUPABASE_URL=https://production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Esas variables también se configuran en el panel de Vercel.

---

## Matriz de ambientes

| Ambiente | URL | Branch | Supabase | Quién lo usa |
|---|---|---|---|---|
| local | `http://localhost:3000` | cualquier rama | proyecto dev | cada developer en su máquina |
| staging | `https://staging.arko.app` | `develop` | proyecto staging | equipo para verificar integración |
| production | `https://app.arko.app` | `main` | proyecto prod | usuarios finales |

---

## Reglas importantes

### No hardcodear URLs

Mal:
```ts
const redirect = "http://localhost:3000/api/v1/auth/meta/callback";
```

Bien:
```ts
import { getMetaRedirectUri } from '@/lib/env';
const redirect = getMetaRedirectUri();
```

### No inventar variables

Si necesitás una variable nueva:
1. Agregala en `.env.example` con un placeholder
2. Agregala en `src/lib/env.ts` con su validación
3. Documentala en esta guía
4. Avisá al equipo

### No mezclar ambientes

Nunca uses credenciales de producción en tu máquina local, salvo que sea estrictamente necesario y coordinado con el equipo.

### Validación automática

Al arrancar la app, `src/lib/env.ts` valida todas las variables obligatorias.
Si falta algo, la app no arranca y te dice exactamente qué falta en la consola.

---

## ¿Qué es `src/lib/env.ts`?

Es el archivo que centraliza todas las variables de entorno del proyecto.

- Valida que las obligatorias existan
- Ofrece helpers como `getAppUrl()` y `getMetaRedirectUri()`
- Si algo falta, falla rápido con un mensaje claro

Regla para IA y developers: **nunca leer `process.env` directamente en código de negocio**. Siempre importar desde `@/lib/env`.

---

## ¿Cómo afecta esto a mi flujo diario?

No cambia nada en tu forma de trabajar. Tu flujo sigue siendo:

1. Actualizar `develop`
2. Crear rama
3. Trabajar en local
4. Abrir PR a `develop`

La diferencia es que ahora:

- Si te falta una variable, la app te lo dice al arrancar
- Si alguien agrega una variable nueva, la vas a ver en `.env.example`
- Las URLs se arman solas según tu ambiente
- No vas a romper staging ni producción por tener `localhost` en el código

---

## ¿Cómo afecta esto a Meta / OAuth / callbacks?

Antes había que configurar `META_REDIRECT_URI` como variable separada.
Ahora se deriva automáticamente de `NEXT_PUBLIC_APP_URL`.

Lo único que tenés que hacer es:

1. En **Meta Developers** → configurar los callbacks permitidos para cada ambiente:
   - `http://localhost:3000/api/v1/auth/meta/callback`
   - `https://staging.arko.app/api/v1/auth/meta/callback`
   - `https://app.arko.app/api/v1/auth/meta/callback`

2. En tu `.env.local` → poner la `NEXT_PUBLIC_APP_URL` correcta para tu ambiente.

No hay nada más que hacer. El código se encarga del resto.

---

## Guía para la IA

Si sos una IA (Windsurf, Claude Code, Cursor, Cline, Aider, Copilot):

- **Nunca** uses `process.env` directamente en código de negocio
- **Siempre** importá desde `@/lib/env`
- **Nunca** hardcodees `localhost` ni URLs absolutas
- Si necesitás una variable nueva, seguí el proceso de 4 pasos de arriba
- Antes de tocar variables de entorno, leé esta guía y `docs/03-security.md`

---

## Archivos relacionados

- `src/lib/env.ts` — configuración centralizada y validación
- `.env.example` — template de variables para el equipo
- `docs/03-security.md` — reglas de seguridad de variables
- `docs/04-deployment.md` — flujo de deploy por ambiente
- `docs/features/team-collaboration.md` — guía general de trabajo en equipo
