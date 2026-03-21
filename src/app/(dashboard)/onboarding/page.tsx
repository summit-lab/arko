import { createClient } from "@/lib/supabase/server";
import { Instagram, CheckCircle2, ArrowRight, Shield, Zap, BarChart3, Link2 } from "lucide-react";
import Link from "next/link";
import { ConnectMetaButton } from "@/components/meta/ConnectMetaButton";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let connectionStatus: string | null = null;
  let igUsername: string | null = null;
  let workspaceId: string | null = null;

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
      igUsername = connection?.ig_username || null;
    }
  }

  const isConnected = connectionStatus === "active";

  const PERMISSIONS = [
    { name: "instagram_graph_user_profile", desc: "Tu perfil público de Instagram" },
    { name: "instagram_graph_user_media", desc: "Tus Reels, fotos y videos" },
    { name: "instagram_manage_insights", desc: "Métricas de rendimiento de tu contenido" },
    { name: "pages_show_list", desc: "Las páginas de Facebook vinculadas" },
    { name: "pages_read_engagement", desc: "Datos de engagement de tus páginas" },
    { name: "ads_read", desc: "Métricas de Meta Ads (solo lectura)" },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="page-title text-3xl">Conectá tu cuenta de Instagram</h1>
        <p className="text-zinc-400 mt-3 text-sm max-w-md mx-auto">
          Arko necesita acceso a tu cuenta de Instagram Business para analizar tus Reels,
          métricas y generar diagnósticos con IA.
        </p>
      </div>

      {/* Status Card */}
      {isConnected ? (
        <div className="glass-panel rounded-2xl p-8 text-center border border-emerald-500/20">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Cuenta conectada</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Tu cuenta <span className="text-white font-medium">@{igUsername}</span> está conectada y activa.
          </p>
          <Link
            href="/instagram"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-sm text-white px-5 py-2.5 rounded-lg transition-colors"
          >
            Ir a IG Intelligence
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Connect Card */}
          <div className="glass-panel rounded-2xl p-8 text-center border border-white/10">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center mx-auto mb-5">
              <Instagram className="h-8 w-8 text-pink-400" />
            </div>

            <h2 className="text-lg font-semibold text-white mb-2">Conectar Instagram Business</h2>
            <p className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto">
              Usamos Meta OAuth para conectarnos de forma segura. Solo necesitamos permisos de lectura.
            </p>

            <ConnectMetaButton workspaceId={workspaceId || ""} />

            <p className="text-[10px] text-zinc-600 mt-4">
              Al conectar, aceptás que Arko acceda a tus datos de Instagram y Meta Ads en modo lectura.
            </p>
          </div>

          {/* What we need */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-400" />
              Permisos requeridos
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {PERMISSIONS.map((p) => (
                <div key={p.name} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <Link2 className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
                  <div>
                    <code className="text-[10px] text-zinc-500">{p.name}</code>
                    <p className="text-xs text-zinc-300 mt-0.5">{p.desc}</p>
                  </div>
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
                <b.icon className="h-5 w-5 text-zinc-400 mb-3" />
                <p className="text-sm font-medium text-white mb-1">{b.title}</p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
