import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return Response.json({ error: "No workspace" }, { status: 401 });

  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, source_type, source_label, amount_total, amount_collected,
      payment_type, payment_status, sale_date, payment_method, notes,
      client_name, client_contact, created_at, reel_id, story_sequence_id,
      reels (id, caption, thumbnail_url, permalink)
    `)
    .eq("workspace_id", workspaceId)
    .order("sale_date", { ascending: false })
    .limit(200);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return Response.json({ error: "No workspace" }, { status: 401 });

  const body = await req.json() as {
    reel_id?: string;
    story_sequence_id?: string;
    source_type: string;
    source_label?: string;
    amount_total: number;
    amount_collected: number;
    payment_type: string;
    payment_status: string;
    sale_date: string;
    payment_method?: string;
    notes?: string;
    client_name?: string;
    client_contact?: string;
  };

  const { data, error } = await supabase
    .from("sales")
    .insert({
      workspace_id: workspaceId,
      reel_id: body.reel_id ?? null,
      story_sequence_id: body.story_sequence_id ?? null,
      source_type: body.source_type,
      source_label: body.source_label ?? null,
      amount_total: body.amount_total,
      amount_collected: body.amount_collected,
      payment_type: body.payment_type,
      payment_status: body.payment_status,
      sale_date: body.sale_date,
      payment_method: body.payment_method ?? null,
      notes: body.notes ?? null,
      client_name: body.client_name ?? null,
      client_contact: body.client_contact ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
