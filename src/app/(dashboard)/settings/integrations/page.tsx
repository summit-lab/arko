import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Instagram, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DisconnectMetaButton } from "@/components/meta/DisconnectMetaButton";

interface MetaConnectionRow {
  id: string;
  status: string;
  ig_username: string | null;
  ig_business_account_id: string | null;
  created_at: string;
}

function formatDate(iso: string | null, dateLocale: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient();
  const t = await getTranslations("settingsIntegrations");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("arko_workspace_id")?.value ?? null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq(workspaceId ? "id" : "owner_id", workspaceId ?? user.id)
    .limit(1)
    .single();

  const resolvedWorkspaceId = workspace?.id ?? null;

  let metaConnection: MetaConnectionRow | null = null;

  if (resolvedWorkspaceId) {
    const { data: metaRow } = await supabase
      .from("meta_connections")
      .select("id, status, ig_username, ig_business_account_id, created_at")
      .eq("workspace_id", resolvedWorkspaceId)
      .maybeSingle();

    metaConnection = (metaRow as MetaConnectionRow | null) ?? null;
  }

  const hasActiveMeta =
    metaConnection?.status === "active" && !!metaConnection.ig_business_account_id;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle")}
        </p>
      </div>

      {/* Instagram */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
          <Instagram className="h-4 w-4 text-muted-foreground" />
          {t("instagram.header")}
        </h2>

        {hasActiveMeta && metaConnection ? (
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[15px] font-light text-foreground">
                  @{metaConnection.ig_username ?? t("instagram.noUsername")}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {t("instagram.connectedSince", { date: formatDate(metaConnection.created_at, dateLocale) })}
                </p>
                <code className="text-[10px] text-muted-foreground mt-1 block">
                  {t("instagram.igIdLabel")}: {metaConnection.ig_business_account_id}
                </code>
              </div>
              {resolvedWorkspaceId ? (
                <DisconnectMetaButton workspaceId={resolvedWorkspaceId} />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-6 text-center">
            <Instagram className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              {t("instagram.noAccount")}
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-sm text-pink-600 dark:text-pink-300 px-5 py-2.5 rounded-lg hover:from-pink-500/30 hover:to-purple-500/30 transition-all"
            >
              <Instagram className="h-4 w-4" />
              {t("instagram.connectAccount")}
            </Link>
          </div>
        )}
      </section>

      {/* YouTube removido del producto (2026-07-02) — no visible en ningún plan. */}
    </div>
  );
}
