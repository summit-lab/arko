"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

async function getWorkspaceSettings() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("arko_workspace_id")?.value;
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("settings")
    .eq("id", workspaceId)
    .single();

  return { supabase, workspaceId, currentSettings: (ws?.settings as Record<string, unknown>) ?? {} };
}

export async function updateBranding(formData: FormData) {
  const brandName = (formData.get("brand_name") as string | null)?.trim() || null;

  const ctx = await getWorkspaceSettings();
  if (!ctx) return;

  await ctx.supabase
    .from("workspaces")
    .update({
      settings: {
        ...ctx.currentSettings,
        brand_name: brandName,
      },
    })
    .eq("id", ctx.workspaceId);

  revalidatePath("/", "layout");
}

export async function updateLogoUrl(logoUrl: string | null) {
  const ctx = await getWorkspaceSettings();
  if (!ctx) return;

  await ctx.supabase
    .from("workspaces")
    .update({
      settings: {
        ...ctx.currentSettings,
        logo_url: logoUrl,
      },
    })
    .eq("id", ctx.workspaceId);

  revalidatePath("/", "layout");
}
