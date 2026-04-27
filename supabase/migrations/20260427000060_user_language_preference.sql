-- Add language preference to profiles (per-user UI + AI generation language).
-- Default 'es' to preserve current behavior. App reads this to drive next-intl locale and AI prompt language.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es'
    CHECK (language IN ('es', 'en'));

COMMENT ON COLUMN public.profiles.language IS
  'User interface and AI generation language (es | en). Drives next-intl locale and prompt language for LLM outputs triggered by this user.';
