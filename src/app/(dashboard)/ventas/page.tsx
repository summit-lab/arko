import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { VentasClient } from "./VentasClient";

export default async function VentasPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  let sales: Array<{
    id: string;
    source_type: string;
    source_label: string | null;
    amount_total: number;
    amount_collected: number;
    payment_type: string;
    payment_status: string;
    sale_date: string;
    payment_method: string | null;
    notes: string | null;
    client_name: string | null;
    reel_id: string | null;
    reels: { id: string; caption: string | null; thumbnail_url: string | null; permalink: string | null } | null;
  }> = [];

  let reelsForPicker: Array<{ id: string; caption: string | null; thumbnail_url: string | null; published_at: string | null }> = [];

  if (workspaceId) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [salesResult, reelsResult] = await Promise.all([
      supabase
        .from("sales")
        .select(`
          id, source_type, source_label, amount_total, amount_collected,
          payment_type, payment_status, sale_date, payment_method, notes,
          client_name, reel_id,
          reels (id, caption, thumbnail_url, permalink)
        `)
        .eq("workspace_id", workspaceId)
        .order("sale_date", { ascending: false })
        .limit(200),
      supabase
        .from("reels")
        .select("id, caption, thumbnail_url, published_at")
        .eq("workspace_id", workspaceId)
        .gte("published_at", ninetyDaysAgo)
        .order("published_at", { ascending: false })
        .limit(100),
    ]);

    if (salesResult.data) {
      sales = salesResult.data.map((s) => ({
        ...s,
        reels: Array.isArray(s.reels) ? (s.reels[0] ?? null) : s.reels,
      })) as typeof sales;
    }
    if (reelsResult.data) reelsForPicker = reelsResult.data;
  }

  return <VentasClient initialSales={sales} reelsForPicker={reelsForPicker} />;
}
