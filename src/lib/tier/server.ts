import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveTier, type Tier } from "./config";

/**
 * Tier del workspace actual resuelto server-side, para gatear páginas
 * (Server Components). Admin = pro; sin workspace = demo (fail-closed).
 * Aplica el auto-downgrade de trial vencido vía resolveTier.
 */
export async function getServerTier(): Promise<Tier> {
  const cookieStore = await cookies();
  if (cookieStore.get("arko_user_role")?.value === "admin") return "pro";

  const workspaceId = cookieStore.get("arko_workspace_id")?.value;
  if (!workspaceId) return "demo";

  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("plan, trial_ends_at")
    .eq("id", workspaceId)
    .single();

  return resolveTier(data?.plan ?? null, data?.trial_ends_at ?? null);
}
