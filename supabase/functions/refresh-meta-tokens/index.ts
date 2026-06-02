/**
 * Supabase Edge Function: refresh-meta-tokens
 *
 * Auto-refresh proactivo de tokens long-lived de Meta. Disparada por el cron
 * `refresh-meta-tokens-daily` (02:00 UTC) o manualmente con x-sync-secret.
 *
 * Flujo:
 *   1. Itera todas las meta_connections con status='active' y
 *      token_expires_at < now() + 14 days (cerca de vencer).
 *   2. Para cada una: decrypt el token actual, llama a Meta
 *      /oauth/access_token?grant_type=fb_exchange_token con ese token.
 *   3. Meta devuelve un access_token nuevo de 60 días (si el token actual
 *      sigue válido). Lo encriptamos y guardamos via RPC refresh_meta_token.
 *   4. Si Meta rechaza el refresh (token revocado, app pausada, etc.) la
 *      connection se marca como 'expired' para que el UI banner avise.
 *
 * Auth: x-sync-secret header (igual que el resto de las funciones cron-driven).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") || "";
const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const META_TOKENS_ENCRYPTION_KEY = Deno.env.get("META_TOKENS_ENCRYPTION_KEY") || "";

// Refresh ventana: las connections que vencen dentro de los próximos N días
// se rotan ahora. 14 días da margen amplio para reintentar si una rotación
// falla en el cron del día (al día siguiente vuelve a intentar).
const REFRESH_WINDOW_DAYS = 14;

interface MetaConnection {
  id: string;
  workspace_id: string;
  ig_username: string | null;
  token_expires_at: string;
}

interface MetaTokenExchangeResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message: string; type: string; code: number };
}

interface RefreshResult {
  workspace_id: string;
  ig_username: string | null;
  outcome: "rotated" | "expired" | "error" | "skipped";
  detail?: string;
}

async function refreshOne(
  supabase: ReturnType<typeof createClient>,
  conn: MetaConnection,
): Promise<RefreshResult> {
  // 1. Decrypt current token via RPC
  const { data: tokenData, error: decryptErr } = await supabase.rpc("get_meta_access_token", {
    p_workspace_id: conn.workspace_id,
    p_encryption_key: META_TOKENS_ENCRYPTION_KEY,
  });

  if (decryptErr || !tokenData) {
    console.warn(`[refresh-meta-tokens] ${conn.workspace_id} decrypt failed:`, decryptErr?.message);
    return { workspace_id: conn.workspace_id, ig_username: conn.ig_username, outcome: "error", detail: "decrypt_failed" };
  }

  const currentToken = tokenData as string;

  // 2. Call Meta to exchange/extend the token
  const url = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", currentToken);

  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    console.warn(`[refresh-meta-tokens] ${conn.workspace_id} fetch error:`, err);
    return { workspace_id: conn.workspace_id, ig_username: conn.ig_username, outcome: "error", detail: "network_error" };
  }

  const exchange = (await res.json().catch(() => ({}))) as MetaTokenExchangeResponse;

  if (!res.ok || exchange.error || !exchange.access_token) {
    const errorCode = exchange.error?.code;
    const errorType = exchange.error?.type;
    const errorMsg = exchange.error?.message ?? `HTTP ${res.status}`;

    // Distinguir un token GENUINAMENTE muerto (revocado / password cambiado /
    // app removida) de un fallo TRANSITORIO de Meta (5xx, rate-limit). Antes se
    // marcaba 'expired' ante CUALQUIER fallo → un hipo de Meta desconectaba al
    // cliente sin razón (banner falso de "reconectá Instagram").
    //   - needs_reauth real: OAuthException o code 190/102/104/467.
    //   - transitorio: 5xx, rate-limit (4/17/32/341/613) → NO tocar la conexión;
    //     el cron reintenta en la próxima ventana.
    const REAUTH_CODES = new Set([190, 102, 104, 467]);
    const RATE_LIMIT_CODES = new Set([4, 17, 32, 341, 613]);
    const isReauth = errorType === "OAuthException" || (errorCode != null && REAUTH_CODES.has(errorCode));
    const isTransient =
      res.status >= 500 ||
      res.status === 429 ||
      (errorCode != null && RATE_LIMIT_CODES.has(errorCode));

    if (isReauth && !isTransient) {
      // Token muerto de verdad → marcar expired para que la UI lo muestre.
      console.warn(
        `[refresh-meta-tokens] ${conn.workspace_id} (@${conn.ig_username}) token needs reauth: code=${errorCode} type=${errorType} msg=${errorMsg}`,
      );
      await supabase
        .from("meta_connections")
        .update({
          status: "expired",
          last_error: `auto_refresh_failed: ${errorMsg.slice(0, 200)}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);
      return {
        workspace_id: conn.workspace_id,
        ig_username: conn.ig_username,
        outcome: "expired",
        detail: errorMsg.slice(0, 200),
      };
    }

    // Fallo transitorio → NO cambiar status. Loguear y reintentar en la próxima corrida.
    console.warn(
      `[refresh-meta-tokens] ${conn.workspace_id} (@${conn.ig_username}) transient refresh failure (no status change): code=${errorCode} status=${res.status} msg=${errorMsg}`,
    );
    return {
      workspace_id: conn.workspace_id,
      ig_username: conn.ig_username,
      outcome: "error",
      detail: `transient: ${errorMsg.slice(0, 180)}`,
    };
  }

  // 3. Save the new token + new expiration via dedicated RPC
  const expiresIn = exchange.expires_in ?? 5184000; // 60 days default
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error: rpcErr } = await supabase.rpc("refresh_meta_token", {
    p_workspace_id: conn.workspace_id,
    p_new_access_token: exchange.access_token,
    p_encryption_key: META_TOKENS_ENCRYPTION_KEY,
    p_new_token_expires_at: newExpiresAt,
  });

  if (rpcErr) {
    console.error(`[refresh-meta-tokens] ${conn.workspace_id} save RPC failed:`, rpcErr.message);
    return { workspace_id: conn.workspace_id, ig_username: conn.ig_username, outcome: "error", detail: `save_failed: ${rpcErr.message}` };
  }

  console.log(
    `[refresh-meta-tokens] ${conn.workspace_id} (@${conn.ig_username}) rotated, new expiry: ${newExpiresAt}`,
  );
  return { workspace_id: conn.workspace_id, ig_username: conn.ig_username, outcome: "rotated", detail: newExpiresAt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-sync-secret, content-type",
      },
    });
  }

  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!META_APP_ID || !META_APP_SECRET || !META_TOKENS_ENCRYPTION_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing required env vars (META_APP_ID, META_APP_SECRET, META_TOKENS_ENCRYPTION_KEY)" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find connections that need refresh: active + within REFRESH_WINDOW_DAYS of expiring.
  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: connections, error: queryErr } = await supabase
    .from("meta_connections")
    .select("id, workspace_id, ig_username, token_expires_at")
    .eq("status", "active")
    .not("token_expires_at", "is", null)
    .lt("token_expires_at", cutoff)
    .order("token_expires_at", { ascending: true });

  if (queryErr) {
    console.error("[refresh-meta-tokens] query failed:", queryErr.message);
    return new Response(JSON.stringify({ error: queryErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const targets = (connections ?? []) as MetaConnection[];
  console.log(`[refresh-meta-tokens] found ${targets.length} connection(s) within ${REFRESH_WINDOW_DAYS}d of expiring`);

  // Sequential to keep Meta API load predictable. Each call is fast (~500ms),
  // so even with 100 connections this finishes well under the 150s edge limit.
  const results: RefreshResult[] = [];
  for (const conn of targets) {
    results.push(await refreshOne(supabase, conn));
  }

  const summary = {
    total: results.length,
    rotated: results.filter((r) => r.outcome === "rotated").length,
    expired: results.filter((r) => r.outcome === "expired").length,
    errors: results.filter((r) => r.outcome === "error").length,
  };
  console.log(`[refresh-meta-tokens] done: ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify({ ok: true, summary, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
