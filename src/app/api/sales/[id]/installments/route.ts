import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

// GET /api/sales/[id]/installments
// Devuelve todas las cuotas de una venta, ordenadas por installment_number.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return Response.json({ error: "No workspace" }, { status: 401 });

  const { data, error } = await supabase
    .from("sale_installments")
    .select("id, sale_id, installment_number, due_date, amount, paid_at, created_at, updated_at")
    .eq("sale_id", id)
    .eq("workspace_id", workspaceId)
    .order("installment_number", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}

// PATCH /api/sales/[id]/installments
// Body: { installment_id: string; paid: boolean }
// Toggle manual: marca/desmarca una cuota como pagada. El trigger de DB
// recalcula sales.amount_collected y payment_status automáticamente.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return Response.json({ error: "No workspace" }, { status: 401 });

  const body = await req.json() as { installment_id: string; paid: boolean; paid_at?: string };
  if (!body.installment_id) {
    return Response.json({ error: "installment_id required" }, { status: 400 });
  }

  // Si paid=true: usar paid_at del body (si viene) o now(). Si paid=false: null.
  const paidAtValue = body.paid
    ? (body.paid_at ?? new Date().toISOString())
    : null;

  const { data: installment, error } = await supabase
    .from("sale_installments")
    .update({ paid_at: paidAtValue })
    .eq("id", body.installment_id)
    .eq("sale_id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Después del UPDATE, el trigger recalc_sale_from_installments ya actualizó
  // sales.amount_collected y payment_status. Re-leemos la venta para que el
  // cliente pueda pintar los valores nuevos sin hacer un GET adicional.
  const { data: sale } = await supabase
    .from("sales")
    .select("id, amount_total, amount_collected, payment_status")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return Response.json({ installment, sale });
}
