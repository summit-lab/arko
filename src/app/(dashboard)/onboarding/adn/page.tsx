import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdnChat } from "@/components/features/onboarding/AdnChat";
import { getAdnProgress, getOrCreateAdnSession, getAdnData } from "@/services/adn-progress.service";
import { getAdnWelcomeMessage } from "@/services/adn-prompts";
import { getUserLanguage } from "@/i18n/server";
import type { PromptLocale } from "@/services/arko-ai-prompts";

export const metadata = {
  title: "ADN de Comunicación | Moka",
};

export default async function AdnOnboardingPage() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("arko_workspace_id")?.value;

  if (!workspaceId) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [progress, sessionId, adnData, locale] = await Promise.all([
    getAdnProgress(supabase, workspaceId),
    getOrCreateAdnSession(supabase, workspaceId, user.id),
    getAdnData(supabase, workspaceId),
    getUserLanguage(user.id) as Promise<PromptLocale>,
  ]);

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    <AdnChat
      initialMessages={messages ?? []}
      initialProgress={progress}
      initialData={adnData}
      welcomeMessage={getAdnWelcomeMessage(locale)}
      sessionId={sessionId}
      workspaceId={workspaceId}
    />
  );
}
