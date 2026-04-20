import { createClient } from "@/lib/supabase/server";
import { Instagram, CheckCircle2, ArrowRight, Shield, Zap, BarChart3, Eye, Image, TrendingUp, FileText, MousePointerClick, Megaphone } from "lucide-react";
import Link from "next/link";
import { ConnectMetaButton } from "@/components/meta/ConnectMetaButton";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Cancelaste el login con Meta. Podés volver a intentarlo.",
  token_exchange_failed: "Meta no devolvió un token válido. Intentá nuevamente.",
  instagram_business_account_not_found: "No encontramos una cuenta de Instagram Business vinculada a la página seleccionada.",
  missing_code_or_state: "La validación del login quedó incompleta. Intentá nuevamente.",
  internal_error: "Ocurrió un error inesperado al conectar Instagram. Intentá nuevamente.",
};

const PERMISSIONS = [
  { icon: Eye, desc: "Tu perfil público de Instagram" },
  { icon: Image, desc: "Tus Reels, fotos y videos" },
  { icon: TrendingUp, desc: "Métricas de rendimiento de tu contenido" },
  { icon: FileText, desc: "Tus páginas de Facebook vinculadas" },
  { icon: MousePointerClick, desc: "Datos de engagement de tus páginas" },
  { icon: Megaphone, desc: "Métricas de Meta Ads (solo lectura)" },
];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; ig_username?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;

  let connectionStatus: string | null = null;
  let igUsername: string | null = null;
  let workspaceId: string | null = null;
  const errorCode = params.error;
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] || "No pudimos completar la conexión con Meta. Intentá nuevamente.") : null;

  if (user) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .single();

    if (workspace) {
      workspaceId = workspace.id;
      const { data: connection } = await supabase
        .from("meta_connections")
        .select("status, ig_username")
        .eq("workspace_id", workspace.id)
        .single();

      connectionStatus = connection?.status || null;
      igUsername = connection?.ig_username || params.ig_username || null;
    }
  }

  const isConnected = connectionStatus === "active";

  return (
    <div className="p-8 max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">Conectar Instagram</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Conectá tu cuenta de Instagram Business para analizar tus Reels, métricas y generar diagnósticos con IA.
        </p>
      </div>

      {/* Status Card */}
      {isConnected ? (
        <div className="glass-panel rounded-xl p-8 border border-emerald-500/20">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Cuenta conectada</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tu cuenta <span className="text-foreground font-medium">@{igUsername}</span> está conectada y activa.
              </p>
            </div>
          </div>
          <Link
            href="/instagram"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 border border-border dark:border-white/10 text-sm px-5 py-2.5 rounded-lg transition-colors mt-5"
          >
            Ir a IG Intelligence
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {errorMessage ? (
            <div className="glass-panel rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p>
            </div>
          ) : null}

          {/* Connect Card */}
          <div className="glass-panel rounded-xl p-8 border border-border dark:border-white/10">
            <div className="flex items-start gap-5">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
                <Instagram className="h-7 w-7 text-pink-500 dark:text-pink-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">Conectar Instagram Business</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Usamos Meta OAuth para conectarnos de forma segura. Solo necesitamos permisos de lectura.
                </p>
                {connectionStatus && connectionStatus !== "active" ? (
                  <p className="text-xs text-muted-foreground mt-2">La conexión actual no está activa. Podés reiniciar el login desde acá.</p>
                ) : null}
                <div className="mt-5 flex">
                  <ConnectMetaButton workspaceId={workspaceId || ""} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  Al conectar, aceptás que Moka acceda a tus datos de Instagram y Meta Ads en modo lectura.
                </p>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm font-semibold text-foreground/80 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Qué datos accedemos
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {PERMISSIONS.map((p) => (
                <div key={p.desc} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03]">
                  <p.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-[13px] text-foreground/80">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: BarChart3, title: "Métricas completas", desc: "Views orgánicas, pagas, engagement, retención y más." },
              { icon: Zap, title: "Diagnóstico IA", desc: "Análisis de hook, guion, visual y CTA con inteligencia artificial." },
              { icon: Instagram, title: "Benchmark 90 días", desc: "Compará cada Reel contra tu promedio y detectá top performers." },
            ].map((b) => (
              <div key={b.title} className="glass-panel rounded-xl p-5">
                <b.icon className="h-5 w-5 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">{b.title}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
