"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale, type Locale } from "@/i18n/config";

/**
 * Admin-only: change a client's UI/AI language. Their own /settings still
 * lets them flip it back, but this lets the admin set the right starting
 * point post-signup (e.g. for users invited before the toggle existed).
 */
export async function updateClientLanguage(
  userId: string,
  language: Locale
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isLocale(language)) return { ok: false, error: "invalid_locale" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Verify the caller is an admin. The /admin route is already gated by
  // middleware, but the server action is independently exposed.
  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (caller?.role !== "admin") return { ok: false, error: "forbidden" };

  const { error } = await supabase
    .from("profiles")
    .update({ language })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients`);
  return { ok: true };
}

/**
 * Admin-only: ajusta la billetera de Moka Coins de un workspace.
 *  - unlimited: monedas infinitas (nunca se bloquea)
 *  - bonusDailyCoins: cupo diario extra sumado al allotment del tier
 *  - resetToday: pone el gastado de hoy (y del mes) en 0
 * Los campos no provistos quedan como están (patch parcial). El write real lo
 * hace la RPC SECURITY DEFINER `moka_admin_adjust`, gated `is_admin()`.
 */
export async function adjustCredits(
  workspaceId: string,
  patch: { unlimited?: boolean; bonusDailyCoins?: number; resetToday?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (caller?.role !== "admin") return { ok: false, error: "forbidden" };

  const { error } = await supabase.rpc("moka_admin_adjust", {
    p_workspace_id: workspaceId,
    p_unlimited: patch.unlimited ?? null,
    p_bonus_daily_coins: patch.bonusDailyCoins ?? null,
    p_reset_today: patch.resetToday ?? false,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients/${workspaceId}`);
  return { ok: true };
}

/**
 * Admin-only: elimina definitivamente la cuenta de un cliente (auth user).
 * Borrar el auth user cascadea profile → workspaces → toda la data del
 * workspace. Antes limpiamos las FKs a auth.users sin ON DELETE que
 * bloquearían el borrado (invitations.used_by, workspace_members.invited_by).
 * Las invitaciones de ese email también se borran para poder re-invitarlo limpio.
 * No permite borrar cuentas admin ni la propia.
 */
export async function deleteClientAccount(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (caller?.role !== "admin") return { ok: false, error: "forbidden" };
  if (userId === user.id) return { ok: false, error: "No podés eliminar tu propia cuenta" };

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("email, role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "La cuenta no existe" };
  if (target.role === "admin") return { ok: false, error: "No se pueden eliminar cuentas admin" };

  const email = (target.email as string).toLowerCase();
  const [{ error: usedError }, { error: emailError }] = await Promise.all([
    admin.from("invitations").delete().eq("used_by", userId),
    admin.from("invitations").delete().eq("email", email),
  ]);
  const invError = usedError ?? emailError;
  if (invError) return { ok: false, error: "Error al limpiar invitaciones: " + invError.message };

  const { error: membersError } = await admin
    .from("workspace_members")
    .update({ invited_by: null })
    .eq("invited_by", userId);
  if (membersError) return { ok: false, error: "Error al limpiar miembros: " + membersError.message };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: "Error al eliminar la cuenta: " + error.message };

  revalidatePath("/admin/clients");
  revalidatePath("/admin/invitations");
  revalidatePath("/admin");
  return { ok: true };
}
