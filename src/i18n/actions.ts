"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * Update the current user's UI language.
 *
 * Persists to `profiles.language` (so AI generations triggered by this user
 * use the correct language) AND sets the `NEXT_LOCALE` cookie (so next-intl
 * picks it up immediately on the next request).
 */
export async function updateUserLocale(locale: Locale): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log(`[i18n action] updateUserLocale called with locale=${locale}`);
  if (!isLocale(locale)) {
    console.log("[i18n action] invalid locale");
    return { ok: false, error: "invalid_locale" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("[i18n action] not authenticated");
    return { ok: false, error: "unauthenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ language: locale })
    .eq("id", user.id);

  if (error) {
    console.log("[i18n action] DB update error:", error.message);
    return { ok: false, error: error.message };
  }
  console.log(`[i18n action] DB updated profiles.language=${locale} for user ${user.id}`);

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  console.log(`[i18n action] cookie set on response: ${LOCALE_COOKIE}=${locale}`);

  revalidatePath("/", "layout");
  return { ok: true };
}
