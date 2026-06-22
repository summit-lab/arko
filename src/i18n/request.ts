import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

/**
 * Locale resolution per request:
 *   1. NEXT_LOCALE cookie (set on sign-in and on toggle)
 *   2. Default ('es')
 *
 * Avoid DB lookups here — this runs on every request. The cookie is refreshed
 * from `profiles.language` at sign-in and whenever the user toggles language.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const messages = (await import(`./messages/${locale}.json`)).default;

  return { locale, messages };
});
