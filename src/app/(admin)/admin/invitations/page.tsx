import { createClient } from "@/lib/supabase/server";
import { InvitationForm } from "./InvitationForm";
import { InvitationList } from "./InvitationList";

export default async function AdminInvitationsPage() {
  const supabase = await createClient();

  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, token, status, expires_at, created_at, used_at, used_by")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="px-8 py-10 space-y-8">
      <div>
        <h1 className="page-title">Invitaciones</h1>
        <p className="text-white/35 mt-3 text-[15px] font-light">
          Generá links de registro para nuevos clientes.
        </p>
      </div>

      {/* Create Invitation */}
      <InvitationForm />

      {/* Invitations List */}
      <InvitationList invitations={invitations ?? []} />
    </div>
  );
}
