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
}
