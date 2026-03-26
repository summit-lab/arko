import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { sales_amount: number | null };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return Response.json({ error: "No workspace" }, { status: 401 });
  }

  const { error } = await supabase
    .from("reels")
    .update({ sales_amount: body.sales_amount })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
