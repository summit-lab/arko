"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function updateBranding(formData: FormData) {
  const brandName = (formData.get("brand_name") as string | null)?.trim() || null;
  const logoUrl = (formData.get("logo_url") as string | null)?.trim() || null;

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("arko_workspace_id")?.value;
  if (!workspaceId) return;

  const supabase = await createClient();

  // Fetch current settings to merge
  const { data: ws } = await supabase
    .from("workspaces")
    .select("settings")
    .eq("id", workspaceId)
    .single();

  const currentSettings = (ws?.settings as Record<string, unknown>) ?? {};

  await supabase
    .from("workspaces")
    .update({
      settings: {
        ...currentSettings,
        brand_name: brandName,
        logo_url: logoUrl,
      },
    })
    .eq("id", workspaceId);

  revalidatePath("/", "layout");
}
