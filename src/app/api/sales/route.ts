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
    // Cuotas — solo requerido si payment_type === 'cuotas'.
    n_cuotas?: number;
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

  // ─── Generar cuotas programadas ───────────────────────────────
  // Si es venta de cuotas, creamos N filas en sale_installments.
  // La primera vence en sale_date, cada siguiente suma 1 mes.
  // Las primeras K cuotas donde K = floor(amount_collected/perCuota)
  // quedan marcadas como paid_at = sale_date (cobro upfront).
  // El trigger de DB se encarga de recalcular sales.amount_collected
  // y payment_status, así que el valor que pasamos arriba se
  // sobreescribe con el cálculo autoritativo.
  if (body.payment_type === "cuotas" && body.n_cuotas && body.n_cuotas >= 2) {
    const n = Math.min(60, Math.max(2, Math.floor(body.n_cuotas)));
    const perCuota = Math.round((body.amount_total / n) * 100) / 100;
    // Última cuota compensa decimales.
    const lastCuota = Math.round((body.amount_total - perCuota * (n - 1)) * 100) / 100;
    const paidCount = perCuota > 0 ? Math.min(n, Math.floor(body.amount_collected / perCuota)) : 0;
    const saleDate = body.sale_date; // YYYY-MM-DD

    const rows = Array.from({ length: n }, (_, i) => {
      const installmentNumber = i + 1;
      // add months preservando el día (JS Date hace clamp natural: 31 enero + 1 mes = 28/29 feb).
      const due = new Date(`${saleDate}T00:00:00Z`);
      due.setUTCMonth(due.getUTCMonth() + i);
      const dueStr = due.toISOString().split("T")[0];
      return {
        sale_id: data.id,
        workspace_id: workspaceId,
        installment_number: installmentNumber,
        due_date: dueStr,
        amount: installmentNumber === n ? lastCuota : perCuota,
        paid_at: installmentNumber <= paidCount ? `${saleDate}T00:00:00Z` : null,
      };
    });

    const { error: installmentsError } = await supabase
      .from("sale_installments")
      .insert(rows);

    if (installmentsError) {
      // No rollback — la venta ya existe. Log y devolver igual: el usuario
      // puede reintentar generando cuotas manualmente desde la UI si hace falta.
      console.error("[sales] installments insert failed:", installmentsError);
    }
  }

  return Response.json(data, { status: 201 });
}
