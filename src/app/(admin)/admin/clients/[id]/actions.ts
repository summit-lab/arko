"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isLocale, type Locale } from "@/i18n/config";

/**
 * Admin-only: change a client's UI/AI language. Their own /settings still
 * lets them flip it back, but this lets the admin set the right starting
 * point post-signup (e.g. for users invited before the toggle existed).
 */
export async function updateClientLanguage(
  userId: string,
  language: Locale
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isLocale(language)) return { ok: false, error: "invalid_locale" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Verify the caller is an admin. The /admin route is already gated by
  // middleware, but the server action is independently exposed.
  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (caller?.role !== "admin") return { ok: false, error: "forbidden" };

  const { error } = await supabase
    .from("profiles")
    .update({ language })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients`);
  return { ok: true };
}
