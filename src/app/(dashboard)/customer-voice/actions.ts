"use server";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

const VALID_METRICS = ["views", "followers", "engagement_rate", "likes", "saves", "reach"] as const;
type GoalMetric = (typeof VALID_METRICS)[number];

function isValidMetric(m: string): m is GoalMetric {
  return VALID_METRICS.includes(m as GoalMetric);
}

export async function upsertGoal(metric: string, targetValue: number) {
  if (!isValidMetric(metric)) throw new Error("Invalid metric");
  if (targetValue <= 0) throw new Error("Target must be positive");

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) throw new Error("No workspace");

  const supabase = await createClient();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { error } = await supabase
    .from("workspace_goals")
    .upsert(
      {
        workspace_id: workspaceId,
        metric,
        target_value: targetValue,
        period_start: periodStart,
        period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,metric,period_start" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/customer-voice");
  revalidatePath("/settings/metas");
}

export async function deleteGoal(metric: string) {
  if (!isValidMetric(metric)) throw new Error("Invalid metric");

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) throw new Error("No workspace");

  const supabase = await createClient();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const { error } = await supabase
    .from("workspace_goals")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("metric", metric)
    .eq("period_start", periodStart);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/customer-voice");
  revalidatePath("/settings/metas");
}

// ─── Content Calendar Actions ────────────────────────────────────────────────

const VALID_PLATFORMS = ["instagram", "youtube", "tiktok", "general"] as const;
const VALID_STATUSES = ["idea", "in_progress", "ready", "published"] as const;

export async function addContentPlanItem(formData: FormData) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return { error: "No workspace" };

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const planned_date = formData.get("planned_date") as string | null;
  const platform = (formData.get("platform") as string) || "instagram";
  const content_type = (formData.get("content_type") as string | null)?.trim() || null;

  if (!title || !planned_date) return { error: "Faltan datos obligatorios" };
  if (!VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])) {
    return { error: "Plataforma inválida" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("content_plan").insert({
    workspace_id: workspaceId,
    planned_date,
    title,
    description,
    platform,
    content_type,
    status: "idea",
  });

  if (error) return { error: error.message };

  revalidatePath("/customer-voice");
  return { success: true };
}

export async function deleteContentPlanItem(id: string) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return { error: "No workspace" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_plan")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  revalidatePath("/customer-voice");
  return { success: true };
}

export async function updateContentPlanStatus(id: string, status: string) {
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return { error: "Estado inválido" };
  }

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return { error: "No workspace" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_plan")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  revalidatePath("/customer-voice");
  return { success: true };
}
