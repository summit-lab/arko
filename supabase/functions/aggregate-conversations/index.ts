/**
 * Supabase Edge Function: aggregate-conversations
 *
 * Daily aggregation of ig_conversation_events into ig_daily_conversations.
 * Runs once per day at 04:00 UTC (01:00 AR) via pg_cron — see docs/07-mcp-guide.md.
 *
 * Computes, for each meta_connections row with webhook_subscribed = true, the
 * previous day's:
 *   - new_conversations  (COUNT of events with is_first_inbound = true)
 *   - messages_received  (COUNT of events with event_type = 'message_received')
 *
 * All date arithmetic is done in America/Argentina/Buenos_Aires local time so
 * the chart matches what the user intuitively calls "ayer".
 *
 * Protected by SYNC_SECRET header, mirrors sync-instagram.
 */

import { createServiceClient } from "../_shared/supabase-client.ts";

const TIMEZONE = "America/Argentina/Buenos_Aires";

interface MetaConnectionRow {
  id: string;
  workspace_id: string;
}

interface AggregateResult {
  connection_id: string;
  date: string;
  new_conversations: number;
  messages_received: number;
  upserted: boolean;
  error?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-sync-secret, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const syncSecret = Deno.env.get("SYNC_SECRET");
  const authHeader = req.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createServiceClient();

  // Re-aggregate the last 3 days (yesterday, -2d, -3d). Late webhook
  // deliveries that arrive after midnight AR would otherwise be silently
  // dropped from the aggregate. UPSERT on (meta_connection_id, date) makes
  // this idempotent, so repeated runs only overwrite with fresher counts.
  const targetDates: string[] = [1, 2, 3].map((offset) =>
    computeOffsetIsoDate(TIMEZONE, offset),
  );

  // Fetch all subscribed connections.
  const { data: connections, error: connError } = await supabase
    .from("meta_connections")
    .select("id, workspace_id")
    .eq("webhook_subscribed", true);

  if (connError) {
    console.error("[aggregate-conversations] connections fetch failed", { error: connError.message });
    return jsonResponse({ status: "error", error: connError.message }, 500);
  }

  const rows = (connections ?? []) as MetaConnectionRow[];
  const results: AggregateResult[] = [];

  for (const conn of rows) {
    for (const date of targetDates) {
      const { startUtc, endUtc } = computeLocalDayRangeUtc(date, TIMEZONE);
      const r = await aggregateForConnection(supabase, conn, date, startUtc, endUtc);
      results.push(r);
    }
  }

  const upserted = results.filter((r) => r.upserted).length;
  const failed = results.filter((r) => !r.upserted && r.error).length;

  return jsonResponse({
    status: "completed",
    dates: targetDates,
    connections_processed: rows.length,
    upserted,
    failed,
    results,
  });
});

// ─── Per-connection aggregation ─────────────────────────────────

async function aggregateForConnection(
  supabase: ReturnType<typeof createServiceClient>,
  conn: MetaConnectionRow,
  date: string,
  startUtc: string,
  endUtc: string,
): Promise<AggregateResult> {
  try {
    // New conversations = rows with is_first_inbound = true in the window.
    const { count: newCount, error: newErr } = await supabase
      .from("ig_conversation_events")
      .select("*", { count: "exact", head: true })
      .eq("meta_connection_id", conn.id)
      .eq("is_first_inbound", true)
      .gte("event_at", startUtc)
      .lt("event_at", endUtc);

    if (newErr) throw newErr;

    // All inbound messages received in the window.
    const { count: msgCount, error: msgErr } = await supabase
      .from("ig_conversation_events")
      .select("*", { count: "exact", head: true })
      .eq("meta_connection_id", conn.id)
      .eq("event_type", "message_received")
      .gte("event_at", startUtc)
      .lt("event_at", endUtc);

    if (msgErr) throw msgErr;

    const { error: upsertErr } = await supabase
      .from("ig_daily_conversations")
      .upsert(
        {
          workspace_id: conn.workspace_id,
          meta_connection_id: conn.id,
          date,
          new_conversations: newCount ?? 0,
          messages_received: msgCount ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "meta_connection_id,date" },
      );

    if (upsertErr) throw upsertErr;

    return {
      connection_id: conn.id,
      date,
      new_conversations: newCount ?? 0,
      messages_received: msgCount ?? 0,
      upserted: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[aggregate-conversations] connection failed", {
      connection_id: conn.id,
      workspace_id: conn.workspace_id,
      error: message,
    });
    return {
      connection_id: conn.id,
      date,
      new_conversations: 0,
      messages_received: 0,
      upserted: false,
      error: message,
    };
  }
}

// ─── Date helpers ───────────────────────────────────────────────

/**
 * Returns an ISO date (YYYY-MM-DD) for `offsetDays` before today in the given
 * timezone. offsetDays=1 → yesterday, offsetDays=3 → three days ago.
 */
function computeOffsetIsoDate(timeZone: string, offsetDays: number): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  // Build a Date at local midnight and subtract offsetDays days.
  const local = new Date(Date.UTC(y, m - 1, d));
  local.setUTCDate(local.getUTCDate() - offsetDays);
  return local.toISOString().slice(0, 10);
}

function computeLocalDayRangeUtc(
  isoDate: string,
  timeZone: string,
): { startUtc: string; endUtc: string } {
  // Given a local date YYYY-MM-DD, compute the exact UTC instants that bound
  // that local day. We do this by probing the timezone's offset at local noon
  // (noon is safe against DST transitions which happen at 00:00 or 03:00).
  const [ys, ms, ds] = isoDate.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);

  const offsetMinutes = tzOffsetMinutes(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), timeZone);
  const startLocal = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMinutes * 60_000;
  const endLocal = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - offsetMinutes * 60_000;

  return {
    startUtc: new Date(startLocal).toISOString(),
    endUtc: new Date(endLocal).toISOString(),
  };
}

function tzOffsetMinutes(date: Date, timeZone: string): number {
  // Offset = (wall-clock time in tz) - (UTC time). Positive for east-of-UTC.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

// ─── Response helper ────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Cron: scheduled in migration `20260420000043_ig_conv_race_cron_retention.sql`
// at 04:00 UTC = 01:00 AR, daily. The function is idempotent (UPSERT keyed on
// (meta_connection_id, date)) and now re-aggregates the last 3 days on every
// run to catch late webhook deliveries that arrived after the prior cutoff.
