import { z } from 'zod';

// ─── Schema de validación ────────────────────────────────────────────────────
// Valida que las variables de entorno obligatorias existan al arrancar.
// Las opcionales solo se validan si la feature correspondiente las necesita.

const envSchema = z.object({
  // ─── Ambiente ───
  APP_ENV: z
    .enum(['local', 'staging', 'production'])
    .default('local'),

  // ─── App ───
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL debe ser una URL válida (ej: http://localhost:3000)'),

  // ─── Supabase (obligatorias) ───
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria'),

  // ─── Supabase server-only (obligatoria en server) ───
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional(),

  // ─── Meta OAuth (opcionales según feature) ───
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_TOKENS_ENCRYPTION_KEY: z.string().optional(),

  // ─── Proveedores IA / externos (opcionales según feature) ───
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  APIFY_API_TOKEN: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),

  // ─── Supabase Edge Function sync secret ───
  SYNC_SECRET: z.string().optional(),
});

// ─── Parsear y validar ───────────────────────────────────────────────────────

function parseEnv() {
  const result = envSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_TOKENS_ENCRYPTION_KEY: process.env.META_TOKENS_ENCRYPTION_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    SYNC_SECRET: process.env.SYNC_SECRET,
  });

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs ?? []).join(', ')}`)
      .join('\n');

    console.error(
      `\n❌ Variables de entorno inválidas:\n${formatted}\n\n` +
      `Revisá tu .env.local y compará con .env.example.\n`
    );

    throw new Error('Variables de entorno inválidas. Ver consola para detalle.');
  }

  return result.data;
}

// ─── Singleton ───────────────────────────────────────────────────────────────
// Se parsea una sola vez. Si falla, la app no arranca.

export const env = parseEnv();

// ─── Helpers derivados ───────────────────────────────────────────────────────
// Usá estos helpers en vez de armar URLs a mano en cada archivo.

/** URL base pública de la app (sin trailing slash) */
export function getAppUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
}

/** URI completa de callback para Meta OAuth.
 *  Meta exige HTTPS. En local se usa `next dev --experimental-https`
 *  para tener https://localhost:3000. Preview y prod ya son HTTPS. */
export function getMetaRedirectUri(): string {
  return `${getAppUrl()}/api/v1/auth/meta/callback`;
}

/** true si estamos en producción */
export function isProduction(): boolean {
  return env.APP_ENV === 'production';
}

/** true si estamos en local */
export function isLocal(): boolean {
  return env.APP_ENV === 'local';
}

// ─── Provider key accessors ─────────────────────────────────────────────────
// Usá estos en vez de process.env directo en services.

export function getAnthropicKey(): string | undefined {
  return env.ANTHROPIC_API_KEY;
}

export function getOpenAIKey(): string | undefined {
  return env.OPENAI_API_KEY;
}

export function getGeminiKey(): string | undefined {
  return env.GEMINI_API_KEY;
}

export function getApifyToken(): string | undefined {
  return env.APIFY_API_TOKEN;
}
