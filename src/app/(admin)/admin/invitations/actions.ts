"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n/config";

type CreateInvitationResult =
  | { token: string; error?: undefined; pendingExpiresAt?: undefined }
  | { error: string; token?: undefined; pendingExpiresAt?: string };

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

  // Check if the email is already registered
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return { error: "Este email ya está registrado" };
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
