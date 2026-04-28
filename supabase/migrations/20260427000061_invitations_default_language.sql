-- Admin can preselect the default language for the invited user.
-- When the user redeems the invitation, profiles.language is set to this value.
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'es'
    CHECK (default_language IN ('es', 'en'));

COMMENT ON COLUMN public.invitations.default_language IS
  'Default UI/AI language assigned to the user upon redeeming this invitation. User can change it later from Settings.';
