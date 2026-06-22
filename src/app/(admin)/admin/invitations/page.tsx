import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { InvitationForm } from "./InvitationForm";
import { InvitationList } from "./InvitationList";

export default async function AdminInvitationsPage() {
  const supabase = await createClient();
  const t = await getTranslations("admin.invitations");

  const { data: invitations, error: invError } = await supabase
    .from("invitations")
    .select("id, email, token, status, expires_at, created_at, used_at, used_by")
    .order("created_at", { ascending: false })
    .limit(50);
  if (invError) console.error('[admin/invitations] fetch error:', invError);

  return (
    <div className="px-8 py-10 space-y-8">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">
          {t("subtitle")}
        </p>
      </div>

      {/* Create Invitation */}
      <InvitationForm />

      {/* Invitations List */}
      <InvitationList invitations={invitations ?? []} />
    </div>
  );
}
