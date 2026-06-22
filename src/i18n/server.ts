import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * Read the current user's stored language from `profiles.language`.
 *
 * Use this in server code that drives **AI generations** (LLM prompts,
 * pipeline analyses) so the output matches the language the user that
 * triggered the action prefers — independent of cookie/UI state.
 *
 * For UI translation in server components prefer `getLocale()` from
 * `next-intl/server` (cookie-driven, no DB hit).
 */
export async function getUserLanguage(userId?: string): Promise<Locale> {
  const supabase = await createClient();

  let id = userId;
  if (!id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_LOCALE;
    id = user.id;
  }

  const { data } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", id)
    .maybeSingle();

  return isLocale(data?.language) ? data.language : DEFAULT_LOCALE;
}

/**
 * Resolve the language for an automated pipeline (cron / sync job) that has
 * no triggering user. Per project decision: take the workspace **owner's**
 * language as the source of truth.
 */
export async function getWorkspaceLanguage(workspaceId: string): Promise<Locale> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("owner_id, profiles:owner_id(language)")
    .eq("id", workspaceId)
    .maybeSingle();

  // Supabase typing for embedded selects is weak — narrow defensively.
  const lang = (data as { profiles?: { language?: string } | null } | null)?.profiles?.language;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}
