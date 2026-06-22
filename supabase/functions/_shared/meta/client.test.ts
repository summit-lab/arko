/**
 * Tests del cliente Meta unificado (F2.5) — mockean `fetch` para simular las
 * respuestas de Graph sin tocar la API real. Cubren el comportamiento del que
 * depende la migración de sync-instagram (metaClientGet wrappea metaFetch):
 *
 *   - Éxito → devuelve body.
 *   - Error de CUERPO de Graph (code 100/190/467/4) → throw con `raw` DEFINIDO.
 *   - Transitorio SIN cuerpo (red / 5xx no-JSON) → throw con `raw` UNDEFINED.
 *
 * Esa invariante (`raw` definido ⟺ Meta devolvió { error } ) es EXACTAMENTE el
 * discriminador que usa metaClientGet para traducir (raw) vs re-lanzar (sin raw),
 * que es el fix de las regresiones M1-M4 del review adversarial.
 *
 * Correr: deno test supabase/functions/_shared/meta/client.test.ts
 */
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { metaFetch, metaFetchPaged, MetaApiError } from "./client.ts";

const origFetch = globalThis.fetch;
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Instala un fetch mock que devuelve la i-ésima respuesta por llamada. Cada
 *  entrada es una Response o una función (puede tirar/rechazar para simular red). */
function installFetch(seq: Array<Response | (() => Response | Promise<Response>)>, rec: { calls: string[] }) {
  let i = 0;
  globalThis.fetch = ((input: unknown) => {
    rec.calls.push(String(input));
    const item = seq[Math.min(i, seq.length - 1)];
    i++;
    try {
      const r = typeof item === "function" ? item() : item;
      return Promise.resolve(r);
    } catch (e) {
      return Promise.reject(e);
    }
  }) as typeof fetch;
}
const restore = () => { globalThis.fetch = origFetch; };

// timeoutMs corto para que los AbortSignal.timeout no dejen timers colgados ~20s.
const OPTS = { timeoutMs: 200 } as const;
const T = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, sanitizeOps: false, sanitizeResources: false }, fn);

T("éxito → devuelve body y llama fetch 1 vez con los params + token", async () => {
  const rec = { calls: [] as string[] };
  installFetch([jsonRes({ data: [{ name: "views", values: [{ value: 42 }] }] })], rec);
  try {
    const r = await metaFetch("/IGID/insights", { token: "TOK", params: { metric: "views,reach" }, ...OPTS });
    assertEquals((r.data as unknown[]).length, 1);
    assertEquals(rec.calls.length, 1);
    assert(rec.calls[0].includes("metric=views%2Creach"), "debe mandar el metric");
    assert(rec.calls[0].includes("access_token=TOK"), "debe mandar el token");
  } finally { restore(); }
});

T("error de cuerpo code 100 → throw unsupported_metric, NO reintenta, raw DEFINIDO (metaClientGet TRADUCE)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([jsonRes({ error: { code: 100, type: "GraphMethodException", message: "Unsupported metric" } }, 400)], rec);
  try {
    const e = await assertRejects(() => metaFetch("/M/insights", { token: "T", ...OPTS }), MetaApiError) as MetaApiError;
    assertEquals(e.kind, "unsupported_metric");
    assertEquals(e.code, 100);
    assert(e.raw !== undefined, "raw definido (hubo cuerpo de error → call site lo trata como data.error)");
    assertEquals(rec.calls.length, 1, "unsupported_metric NO es retryable");
  } finally { restore(); }
});

T("auth code 190 (OAuthException) → needs_reauth, raw DEFINIDO", async () => {
  const rec = { calls: [] as string[] };
  installFetch([jsonRes({ error: { code: 190, type: "OAuthException", message: "expired" } }, 400)], rec);
  try {
    const e = await assertRejects(() => metaFetch("/A", { token: "T", ...OPTS }), MetaApiError) as MetaApiError;
    assertEquals(e.kind, "needs_reauth");
    assertEquals(e.code, 190);
    assert(e.raw !== undefined);
    assertEquals(rec.calls.length, 1);
  } finally { restore(); }
});

T("code 467 → needs_reauth a nivel cliente, raw DEFINIDO (doc: sync-instagram igual lo ignora vía isTokenExpiredError)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([jsonRes({ error: { code: 467, message: "session invalid" } }, 400)], rec);
  try {
    const e = await assertRejects(() => metaFetch("/A", { token: "T", ...OPTS }), MetaApiError) as MetaApiError;
    assertEquals(e.kind, "needs_reauth");
    assertEquals(e.code, 467);
    // metaClientGet lo traduce a {error:{code:467}}; isTokenExpiredError NO incluye 467
    // → fetchProfileFields devuelve null (NO marca expired), idéntico al legacy.
    assert(e.raw !== undefined);
  } finally { restore(); }
});

T("rate-limit code 4 → rate_limit, raw DEFINIDO (metaClientGet TRADUCE → call site hace break, como legacy)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([jsonRes({ error: { code: 4, message: "rate limit" } }, 400)], rec);
  try {
    const e = await assertRejects(() => metaFetch("/A", { token: "T", maxRetries: 0, ...OPTS }), MetaApiError) as MetaApiError;
    assertEquals(e.kind, "rate_limit");
    assertEquals(e.code, 4);
    assert(e.raw !== undefined, "rate-limit trae cuerpo → se traduce, NO se re-lanza");
  } finally { restore(); }
});

T("error de RED → throw server, raw UNDEFINED (metaClientGet RE-LANZA, como el fetch crudo legacy)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([() => { throw new TypeError("network down"); }], rec);
  try {
    const e = await assertRejects(() => metaFetch("/A", { token: "T", maxRetries: 0, ...OPTS }), MetaApiError) as MetaApiError;
    assertEquals(e.kind, "server");
    assertEquals(e.raw, undefined, "sin cuerpo → metaClientGet re-lanza → preserva abort/propagate legacy (fix M1-M4)");
  } finally { restore(); }
});

T("5xx SIN JSON (HTML) → throw server, raw UNDEFINED (RE-LANZA)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([() => new Response("<html>502 Bad Gateway</html>", { status: 502 })], rec);
  try {
    const e = await assertRejects(() => metaFetch("/A", { token: "T", maxRetries: 0, ...OPTS }), MetaApiError) as MetaApiError;
    assertEquals(e.kind, "server");
    assertEquals(e.raw, undefined);
  } finally { restore(); }
});

T("retry: 1 fallo de red y luego éxito → se recupera (la mejora pura de resiliencia)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([
    () => { throw new TypeError("blip"); },
    jsonRes({ data: [{ ok: true }] }),
  ], rec);
  try {
    const r = await metaFetch("/A", { token: "T", maxRetries: 1, ...OPTS });
    assertEquals((r.data as unknown[]).length, 1);
    assertEquals(rec.calls.length, 2, "reintentó una vez y la segunda funcionó");
  } finally { restore(); }
});

T("metaFetchPaged → concatena páginas siguiendo paging.next (URL absoluta)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([
    jsonRes({ data: [1, 2], paging: { next: "https://graph.facebook.com/v25.0/next?access_token=EMB" } }),
    jsonRes({ data: [3] }),
  ], rec);
  try {
    const all = await metaFetchPaged<number>("/A/media", { token: "T", params: { limit: 50 }, ...OPTS });
    assertEquals(all, [1, 2, 3]);
    assertEquals(rec.calls.length, 2);
    assert(rec.calls[1].startsWith("https://graph.facebook.com/v25.0/next"), "2da página usa la URL absoluta next");
  } finally { restore(); }
});

T("URL absoluta → NO re-agrega token/params (respeta el token embebido de paging.next)", async () => {
  const rec = { calls: [] as string[] };
  installFetch([jsonRes({ data: [] })], rec);
  try {
    await metaFetch("https://graph.facebook.com/v25.0/x?after=ABC&access_token=EMBEDDED", { token: "OTHER", ...OPTS });
    assertEquals(rec.calls[0], "https://graph.facebook.com/v25.0/x?after=ABC&access_token=EMBEDDED");
    assert(!rec.calls[0].includes("OTHER"), "no debe pisar el token embebido");
  } finally { restore(); }
});
