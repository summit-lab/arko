import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Instagram, Youtube, Calendar, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DisconnectMetaButton } from "@/components/meta/DisconnectMetaButton";
import { DmTrackingControls } from "@/components/settings/DmTrackingControls";

interface MetaConnectionRow {
  id: string;
  status: string;
  ig_username: string | null;
  ig_business_account_id: string | null;
  webhook_subscribed: boolean;
  webhook_subscribed_at: string | null;
  created_at: string;
}

interface YtChannelRow {
  id: string;
  title: string | null;
  custom_url: string | null;
  subscriber_count: number | null;
  created_at: string;
}

function formatRelativeSpanish(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return "ahora";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "hace unos segundos";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} meses`;
  const years = Math.floor(months / 12);
  return `hace ${years} años`;
}

function formatDateSpanish(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient();
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
  let lastEventAt: string | null = null;
  let ytChannels: YtChannelRow[] = [];

  if (resolvedWorkspaceId) {
    const [{ data: metaRow }, { data: ytRows }] = await Promise.all([
      supabase
        .from("meta_connections")
        .select(
          "id, status, ig_username, ig_business_account_id, webhook_subscribed, webhook_subscribed_at, created_at"
        )
        .eq("workspace_id", resolvedWorkspaceId)
        .maybeSingle(),
      supabase
        .from("yt_channels")
        .select("id, title, custom_url, subscriber_count, created_at")
        .eq("workspace_id", resolvedWorkspaceId)
        .order("created_at", { ascending: true }),
    ]);

    metaConnection = (metaRow as MetaConnectionRow | null) ?? null;
    ytChannels = (ytRows as YtChannelRow[] | null) ?? [];

    if (metaConnection?.id) {
      const { data: lastEvent } = await supabase
        .from("ig_conversation_events")
        .select("received_at")
        .eq("meta_connection_id", metaConnection.id)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastEventAt = (lastEvent?.received_at as string | undefined) ?? null;
    }
  }

  const hasActiveMeta =
    metaConnection?.status === "active" && !!metaConnection.ig_business_account_id;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Integraciones</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Conectá tus cuentas y controlá qué datos recibe Moka.
        </p>
      </div>

      {/* Instagram */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
          <Instagram className="h-4 w-4 text-muted-foreground" />
          Instagram
        </h2>

        {hasActiveMeta && metaConnection ? (
          <div className="glass-panel rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[15px] font-light text-foreground">
                  @{metaConnection.ig_username ?? "(sin username)"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Conectado desde {formatDateSpanish(metaConnection.created_at)}
                </p>
                <code className="text-[10px] text-muted-foreground mt-1 block">
                  IG ID: {metaConnection.ig_business_account_id}
                </code>
              </div>
              {resolvedWorkspaceId ? (
                <DisconnectMetaButton workspaceId={resolvedWorkspaceId} />
              ) : null}
            </div>

            <div className="border-t border-white/[0.06] pt-5">
              <DmTrackingControls
                metaConnectionId={metaConnection.id}
                initialEnabled={metaConnection.webhook_subscribed}
                lastEventLabel={
                  lastEventAt
                    ? `${formatRelativeSpanish(lastEventAt)} (${formatDateSpanish(lastEventAt)})`
                    : null
                }
              />
              {metaConnection.webhook_subscribed_at ? (
                <p className="text-[10px] text-muted-foreground mt-3">
                  Activado: {formatDateSpanish(metaConnection.webhook_subscribed_at)}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-6 text-center">
            <Instagram className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No hay una cuenta de Instagram conectada.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-sm text-pink-600 dark:text-pink-300 px-5 py-2.5 rounded-lg hover:from-pink-500/30 hover:to-purple-500/30 transition-all"
            >
              <Instagram className="h-4 w-4" />
              Conectar cuenta
            </Link>
          </div>
        )}
      </section>

      {/* YouTube */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
          <Youtube className="h-4 w-4 text-muted-foreground" />
          YouTube
        </h2>

        {ytChannels.length > 0 ? (
          <div className="space-y-3">
            {ytChannels.map((channel) => (
              <div key={channel.id} className="glass-panel rounded-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-light text-foreground">
                      {channel.title ?? "(canal sin título)"}
                    </p>
                    {channel.custom_url ? (
                      <p className="text-xs text-muted-foreground mt-1">{channel.custom_url}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      Conectado desde {formatDateSpanish(channel.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                      sincronizando
                    </span>
                  </div>
                </div>
                {typeof channel.subscriber_count === "number" ? (
                  <p className="text-[10px] text-muted-foreground mt-3">
                    {channel.subscriber_count.toLocaleString("es-AR")} suscriptores
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-6 text-center">
            <Youtube className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No tenés un canal de YouTube conectado.
            </p>
            <Link
              href="/youtube"
              className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.10] text-sm text-foreground px-5 py-2.5 rounded-lg hover:bg-white/[0.10] transition-all"
            >
              <Youtube className="h-4 w-4" />
              Conectar canal
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
