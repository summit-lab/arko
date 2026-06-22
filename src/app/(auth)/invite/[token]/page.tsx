import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { InviteRegisterForm } from "./InviteRegisterForm";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const t = await getTranslations("auth.invite");

  // Validate the invitation token via RPC
  const { data, error } = await supabase.rpc("validate_invitation", {
    p_token: token,
  });

  const invitation = data?.[0] ?? null;
  const isValid = !error && invitation?.valid === true;

  return (
    <div className="glass-panel rounded-xl p-8 space-y-6">
      {/* Logo */}
      <div className="flex items-center gap-3 justify-center mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/moka.svg"
          alt="Moka"
          width={32}
          height={32}
          style={{ width: 32, height: 32, objectFit: "contain" }}
        />
        <p className="text-[26px] font-bold tracking-tight leading-none text-foreground">
          Moka
        </p>
      </div>

      {isValid && invitation ? (
        <>
          <div className="text-center">
            <h1 className="text-[22px] font-light text-foreground tracking-tight">
              {t("welcomeTitle")}
            </h1>
            <p className="text-muted-foreground mt-2 text-[14px] font-light">
              {t("welcomeSubtitle")}
            </p>
          </div>
          <InviteRegisterForm email={invitation.email} token={token} />
        </>
      ) : (
        <div className="text-center py-8">
          <div className="h-16 w-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-[20px] font-light text-foreground tracking-tight">
            {t("invalidTitle")}
          </h1>
          <p className="text-muted-foreground mt-2 text-[14px] font-light">
            {t("invalidDescription")}
          </p>
        </div>
      )}
    </div>
  );
}
