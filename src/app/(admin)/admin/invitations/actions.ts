"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n/config";

type CreateInvitationResult =
  | { token: string; error?: undefined; pendingExpiresAt?: undefined; existingAccount?: undefined }
  | { error: string; token?: undefined; pendingExpiresAt?: string; existingAccount?: { plan: string | null } };

export async function createInvitation(formData: FormData): Promise<CreateInvitationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Email inválido" };
  }

  const rawLanguage = formData.get("default_language");
  const defaultLanguage = isLocale(rawLanguage) ? rawLanguage : "es";

  // Trial gratis elegido por el admin (30/60/90 días). El conteo arranca cuando
  // el usuario se registra; lo estampa el trigger handle_new_user().
  const rawTrial = Number(formData.get("trial_days"));
  const trialDays = [30, 60, 90].includes(rawTrial) ? rawTrial : 30;

  // Tier asignado por el admin: demo (lead) / standard (free trial) / pro (full).
  // El trigger handle_new_user solo estampa el trial si el plan es 'standard'.
  const rawPlan = formData.get("plan");
  const plan = rawPlan === "demo" || rawPlan === "standard" || rawPlan === "pro" ? rawPlan : "standard";

  // Si el email ya tiene cuenta (típico: lead que se registró solo en la Demo)
  // no se invita: la UI ofrece cambiarle el plan in-place con changeExistingAccountPlan.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    const { data: ownWorkspace } = await supabase
      .from("workspaces")
      .select("plan")
      .eq("owner_id", existingProfile.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      error: "Este email ya está registrado",
      existingAccount: { plan: (ownWorkspace?.plan as string | null) ?? null },
    };
  }

  // Las pendientes vencidas por fecha nunca se marcan solas: las cerramos acá
  // para que no bloqueen el reenvío (la UI ya las muestra como "Expirada").
  const nowIso = new Date().toISOString();
  await supabase
    .from("invitations")
    .update({ status: "expired" })
    .eq("email", email)
    .eq("status", "pending")
    .lt("expires_at", nowIso);

  // Si hay una pendiente vigente, pedimos confirmación antes de reemplazarla.
  const replace = formData.get("replace") === "1";
  const { data: existing } = await supabase
    .from("invitations")
    .select("id, expires_at")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existing && !replace) {
    return {
      error: "Ya existe una invitación pendiente para este email",
      pendingExpiresAt: existing.expires_at as string,
    };
  }

  if (existing && replace) {
    const { error: expireError } = await supabase
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", existing.id)
      .eq("status", "pending");
    if (expireError) {
      return { error: "Error al cancelar la invitación anterior: " + expireError.message };
    }
  }

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      email,
      invited_by: user.id,
      default_language: defaultLanguage,
      trial_days: trialDays,
      plan,
    })
    .select("token")
    .single();

  if (error) {
    return { error: "Error al crear invitación: " + error.message };
  }

  revalidatePath("/admin/invitations");
  return { token: data.token };
}

export async function expireInvitation(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { error } = await supabase
    .from("invitations")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "pending");

  if (error) console.error('[admin/invitations] expire error:', error);

  revalidatePath("/admin/invitations");
}

/**
 * Admin-only: cambia el plan de una cuenta YA registrada (ej. un lead de la
 * Demo que pasa a Free Trial/Full) sin pedirle otro email. Replica lo que hace
 * handle_new_user() al registrarse: standard estampa trial_days/started/ends;
 * demo/pro limpian el trial. El trigger prevent_plan_self_escalation deja pasar
 * el cambio porque el caller es admin (policy admin_update_workspaces).
 */
export async function changeExistingAccountPlan(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (caller?.role !== "admin") return { ok: false, error: "Sin permiso" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "Email inválido" };

  const rawPlan = formData.get("plan");
  const plan = rawPlan === "demo" || rawPlan === "standard" || rawPlan === "pro" ? rawPlan : null;
  if (!plan) return { ok: false, error: "Plan inválido" };

  const rawTrial = Number(formData.get("trial_days"));
  const trialDays = [30, 60, 90].includes(rawTrial) ? (rawTrial as 30 | 60 | 90) : 30;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile) return { ok: false, error: "No hay cuenta registrada con este email" };

  const now = new Date();
  const isTrial = plan === "standard";
  const { data: updated, error } = await supabase
    .from("workspaces")
    .update({
      plan,
      trial_days: isTrial ? trialDays : null,
      trial_started_at: isTrial ? now.toISOString() : null,
      trial_ends_at: isTrial ? new Date(now.getTime() + trialDays * 86_400_000).toISOString() : null,
    })
    .eq("owner_id", profile.id)
    .select("id");

  if (error) return { ok: false, error: "Error al cambiar el plan: " + error.message };
  if (!updated || updated.length === 0) return { ok: false, error: "La cuenta no tiene workspace" };

  revalidatePath("/admin/invitations");
  revalidatePath("/admin/clients");
  return { ok: true };
}
