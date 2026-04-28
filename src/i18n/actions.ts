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
  if (!isLocale(locale)) {
    return { ok: false, error: "invalid_locale" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ language: locale })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
