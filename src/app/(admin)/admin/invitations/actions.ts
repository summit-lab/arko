"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createInvitation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Email inválido" };
  }

  // Check if there's already a pending invitation for this email
  const { data: existing } = await supabase
    .from("invitations")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "Ya existe una invitación pendiente para este email" };
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

  await supabase
    .from("invitations")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "pending");

  revalidatePath("/admin/invitations");
}
