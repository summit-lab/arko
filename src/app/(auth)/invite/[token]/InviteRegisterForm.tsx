"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, User, Lock } from "lucide-react";
import { registerWithInvite } from "@/app/(auth)/actions";

interface Props {
  email: string;
  token: string;
}

export function InviteRegisterForm({ email, token }: Props) {
  const t = useTranslations("auth.invite");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await registerWithInvite(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // If no error, redirect happens server-side
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      {/* Email (read-only) */}
      <div>
        <label className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-2 block">
          Email
        </label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full h-[42px] px-4 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[14px] text-white/40 outline-none cursor-not-allowed"
        />
      </div>

      {/* Full Name */}
      <div>
        <label className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-2 block">
          {t("fullNameLabel")}
        </label>
        <div className="relative">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            name="full_name"
            type="text"
            required
            placeholder={t("fullNamePlaceholder")}
            className="w-full h-[42px] pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[14px] text-white/80 placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-2 block">
          {t("passwordLabel")}
        </label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder={t("passwordPlaceholder")}
            className="w-full h-[42px] pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[14px] text-white/80 placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-red-400 bg-red-400/10 px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-[44px] rounded-lg bg-white/[0.08] border border-white/[0.12] text-white text-[14px] font-medium hover:bg-white/[0.12] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
