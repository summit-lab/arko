"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail, Copy, Check, Loader2 } from "lucide-react";
import { createInvitation, changeExistingAccountPlan } from "./actions";
import type { Locale } from "@/i18n/config";
import { TIER_LABEL, type Tier } from "@/lib/tier/config";

function tierLabel(plan: FormDataEntryValue | string | null): string {
  return plan === "demo" || plan === "standard" || plan === "pro" ? TIER_LABEL[plan as Tier] : "—";
}

export function InvitationForm() {
  const t = useTranslations("admin.invitations.form");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [defaultLanguage, setDefaultLanguage] = useState<Locale>("es");
  const [trialDays, setTrialDays] = useState<30 | 60 | 90>(30);
  const [plan, setPlan] = useState<"demo" | "standard" | "pro">("standard");

  // Si ya hay una invitación pendiente vigente, guardamos el form para reenviarlo
  // con replace=1 cuando el admin confirma que se cancele la anterior.
  const [pendingConflict, setPendingConflict] = useState<{ formData: FormData; expiresAt: string } | null>(null);

  // Si el email ya tiene cuenta (lead de la Demo), en vez de invitar ofrecemos
  // cambiarle el plan in-place: así no tiene que registrarse con otro email.
  const [existingAccount, setExistingAccount] = useState<{ formData: FormData; currentPlan: string | null } | null>(null);
  const [planChanged, setPlanChanged] = useState<string | null>(null);

  function resetFeedback() {
    setError(null);
    setGeneratedLink(null);
    setPendingConflict(null);
    setExistingAccount(null);
    setPlanChanged(null);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    resetFeedback();

    const result = await createInvitation(formData);

    if (result.existingAccount) {
      setExistingAccount({ formData, currentPlan: result.existingAccount.plan });
    } else if (result.pendingExpiresAt) {
      setPendingConflict({ formData, expiresAt: result.pendingExpiresAt });
    } else if (result.error) {
      setError(result.error);
    } else if (result.token) {
      const base = window.location.origin;
      setGeneratedLink(`${base}/invite/${result.token}`);
    }

    setLoading(false);
  }

  async function replacePending() {
    if (!pendingConflict) return;
    const formData = pendingConflict.formData;
    formData.set("replace", "1");
    await handleSubmit(formData);
  }

  async function changePlan() {
    if (!existingAccount) return;
    const { formData } = existingAccount;
    setLoading(true);
    const result = await changeExistingAccountPlan(formData);
    if (result.ok) {
      resetFeedback();
      setPlanChanged(tierLabel(formData.get("plan")));
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  async function copyLink() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="glass-card p-6 animate-slide-up stagger-1">
      <h3 className="text-[15px] font-light text-white tracking-wide mb-5">
        {t("title")}
      </h3>

      <form action={handleSubmit} className="space-y-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-2 block">
              {t("emailLabel")}
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                name="email"
                type="email"
                required
                placeholder={t("emailPlaceholder")}
                autoComplete="off"
                className="w-full h-[42px] pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[14px] text-white/80 placeholder:text-muted-foreground outline-none focus:border-amber-400/30 transition-colors autofill-dark"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-2 block">
              {t("languageLabel")}
            </label>
            <input type="hidden" name="default_language" value={defaultLanguage} />
            <div className="inline-flex items-center h-[42px] rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5">
              <button
                type="button"
                onClick={() => setDefaultLanguage("es")}
                className={`h-[34px] px-3 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
                  defaultLanguage === "es"
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                🇦🇷 ES
              </button>
              <button
                type="button"
                onClick={() => setDefaultLanguage("en")}
                className={`h-[34px] px-3 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
                  defaultLanguage === "en"
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-2 block">
              Plan
            </label>
            <input type="hidden" name="plan" value={plan} />
            <div className="inline-flex items-center h-[42px] rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5">
              {([["demo", "Demo"], ["standard", "Free Trial"], ["pro", "Full"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPlan(val)}
                  className={`h-[34px] px-3 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
                    plan === val
                      ? "bg-white/[0.08] text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {plan === "standard" && (
            <div>
              <label className="text-[11px] text-white/40 uppercase tracking-[0.1em] font-medium mb-2 block">
                {t("trialLabel")}
              </label>
              <input type="hidden" name="trial_days" value={trialDays} />
              <div className="inline-flex items-center h-[42px] rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5">
                {([30, 60, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTrialDays(d)}
                    className={`h-[34px] px-3 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
                      trialDays === d
                        ? "bg-white/[0.08] text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="h-[42px] px-6 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[13px] font-medium hover:bg-amber-400/15 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {t("submit")}
          </button>
        </div>
        <p className="text-[11px] text-white/30">{t("languageHint")}</p>
      </form>

      {error && (
        <div className="mt-4 text-[13px] text-red-400 bg-red-400/10 px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {existingAccount && (
        <div className="mt-4 flex items-center gap-3 flex-wrap bg-amber-400/5 border border-amber-400/15 rounded-lg px-4 py-3">
          <p className="flex-1 min-w-[200px] text-[13px] text-amber-400/80">
            {t("existingAccount", {
              current: tierLabel(existingAccount.currentPlan),
              target: tierLabel(existingAccount.formData.get("plan")),
            })}
            {existingAccount.formData.get("plan") === "standard" &&
              ` ${t("existingAccountTrial", { days: String(existingAccount.formData.get("trial_days") ?? 30) })}`}
          </p>
          <button
            type="button"
            onClick={() => setExistingAccount(null)}
            disabled={loading}
            className="shrink-0 h-8 px-3 rounded-md text-white/40 text-[12px] font-medium hover:text-white/70 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("existingAccountCancel")}
          </button>
          <button
            type="button"
            onClick={changePlan}
            disabled={loading}
            className="shrink-0 h-8 px-3 rounded-md bg-amber-400/10 text-amber-400 text-[12px] font-medium hover:bg-amber-400/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            {t("existingAccountConfirm", { target: tierLabel(existingAccount.formData.get("plan")) })}
          </button>
        </div>
      )}

      {planChanged && (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-emerald-400/80 bg-emerald-400/5 border border-emerald-400/15 rounded-lg px-4 py-3">
          <Check size={14} />
          {t("planChanged", { target: planChanged })}
        </div>
      )}

      {pendingConflict && (
        <div className="mt-4 flex items-center gap-3 flex-wrap bg-amber-400/5 border border-amber-400/15 rounded-lg px-4 py-3">
          <p className="flex-1 min-w-[200px] text-[13px] text-amber-400/80">
            {t("pendingConflict", {
              date: new Date(pendingConflict.expiresAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" }),
            })}
          </p>
          <button
            type="button"
            onClick={() => setPendingConflict(null)}
            disabled={loading}
            className="shrink-0 h-8 px-3 rounded-md text-white/40 text-[12px] font-medium hover:text-white/70 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("keepPending")}
          </button>
          <button
            type="button"
            onClick={replacePending}
            disabled={loading}
            className="shrink-0 h-8 px-3 rounded-md bg-amber-400/10 text-amber-400 text-[12px] font-medium hover:bg-amber-400/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            {t("replacePending")}
          </button>
        </div>
      )}

      {generatedLink && (
        <div className="mt-4 flex items-center gap-3 bg-emerald-400/5 border border-emerald-400/15 rounded-lg px-4 py-3">
          <p className="flex-1 text-[13px] text-emerald-400/80 font-mono truncate">
            {generatedLink}
          </p>
          <button
            onClick={copyLink}
            className="shrink-0 h-8 px-3 rounded-md bg-emerald-400/10 text-emerald-400 text-[12px] font-medium hover:bg-emerald-400/20 transition-all cursor-pointer flex items-center gap-1.5"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      )}
    </div>
  );
}
