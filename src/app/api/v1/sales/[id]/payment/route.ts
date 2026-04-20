/**
 * POST /api/v1/sales/[id]/payment
 * Register an additional payment toward an existing sale (cuotas/deposito flows).
 *
 * Body: { amount: number, paid_at?: string (YYYY-MM-DD) }
 * Response: updated sale row
 * Errors:
 *   400 — invalid amount / bad body
 *   401 — no workspace
 *   409 — payment would exceed amount_total, or sale not found/cancelled/unauthorized
 *
 * Concurrency: the RPC `apply_sale_payment` performs a single atomic UPDATE
 * with a row lock, overflow guard, and status flip. This replaces the old
 * read-modify-write pattern which had a TOCTOU race.
 * See migration 20260420000042_sales_amount_check.sql.
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

interface PaymentBody {
  amount: number;
  paid_at?: string;
}

interface SaleRow {
  id: string;
  workspace_id: string;
  amount_total: number;
  amount_collected: number;
  payment_status: string;
  notes: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PaymentBody;
  try {
    body = (await req.json()) as PaymentBody;
  } catch {
    return Response.json({ error: "Bad Request", message: "JSON inválido" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json(
      { error: "Bad Request", message: "amount debe ser un número mayor a 0" },
      { status: 400 }
    );
  }

  // paid_at is accepted for API compatibility but the DB function stamps
  // CURRENT_DATE to keep the trace in sync with the transaction. If we
  // ever need user-supplied dates, extend the RPC signature.
  const paidAt = body.paid_at ?? new Date().toISOString().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    return Response.json(
      { error: "Bad Request", message: "paid_at debe tener formato YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Single atomic call — row lock, overflow guard, status flip, and notes
  // append all happen inside the DB. Any P0001 from the function means the
  // sale isn't eligible (not found, over amount_total, cancelled, or the
  // caller isn't a workspace member).
  const { data: updated, error: rpcErr } = await supabase
    .rpc("apply_sale_payment", { p_sale_id: id, p_amount: amount })
    .single<SaleRow>();

  if (rpcErr) {
    const msg = rpcErr.message ?? "";
    // Postgres RAISE with ERRCODE P0001 surfaces as code "P0001" in postgrest.
    if (rpcErr.code === "P0001" || msg.includes("Payment failed") || msg.includes("Invalid payment amount")) {
      return Response.json(
        {
          error: "Conflict",
          message: "El pago no pudo aplicarse: la venta no existe, excede el total, está cancelada o no tenés permiso.",
        },
        { status: 409 }
      );
    }
    // CHECK constraint violation (defence-in-depth).
    if (rpcErr.code === "23514") {
      return Response.json(
        { error: "Conflict", message: "El pago excede el total de la venta." },
        { status: 409 }
      );
    }
    return Response.json({ error: "Internal Server Error", message: msg }, { status: 500 });
  }

  if (!updated) {
    return Response.json(
      { error: "Conflict", message: "El pago no pudo aplicarse." },
      { status: 409 }
    );
  }

  return Response.json(updated, { status: 200 });
}
