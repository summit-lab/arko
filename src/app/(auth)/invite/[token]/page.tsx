import { createClient } from "@/lib/supabase/server";
import { InviteRegisterForm } from "./InviteRegisterForm";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

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
        <svg width="32" height="32" viewBox="0 0 607.13 523.93" xmlns="http://www.w3.org/2000/svg" aria-label="Arko">
          <defs>
            <linearGradient id="logo-grad-inv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#9a9a9a" />
            </linearGradient>
          </defs>
          <path fill="url(#logo-grad-inv)" d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z" />
          <path fill="url(#logo-grad-inv)" d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z" />
        </svg>
        <p
          className="text-[26px] font-bold tracking-tight leading-none"
          style={{ background: "linear-gradient(to bottom, #ffffff 0%, #9a9a9a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          Arko
        </p>
      </div>

      {isValid && invitation ? (
        <>
          <div className="text-center">
            <h1 className="text-[22px] font-light text-white tracking-tight">
              Bienvenido a Arko
            </h1>
            <p className="text-white/35 mt-2 text-[14px] font-light">
              Creá tu cuenta para comenzar.
            </p>
          </div>
          <InviteRegisterForm email={invitation.email} token={token} />
        </>
      ) : (
        <div className="text-center py-8">
          <div className="h-16 w-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-[20px] font-light text-white tracking-tight">
            Invitación no válida
          </h1>
          <p className="text-white/35 mt-2 text-[14px] font-light">
            Este link de invitación es inválido, ya fue usado o expiró.
          </p>
        </div>
      )}
    </div>
  );
}
