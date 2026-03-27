/**
 * adn-progress.service.ts
 * Tracks ADN de Comunicación completion across the 6 onboarding tables.
 * Used by the onboarding chat API and middleware to determine progress.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionProgress {
  complete: boolean;
  fields_filled: string[];
}

export interface AdnProgress {
  sections: {
    profile: SectionProgress;
    strategies: { complete: boolean; platforms: string[] };
    market: SectionProgress;
    competitors: { complete: boolean; count: number };
    brand: SectionProgress;
    references: { complete: boolean; count: number };
  };
  overall_complete: boolean;
  current_section: 1 | 2 | 3 | 4;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filledFields(row: Record<string, unknown> | null, keys: string[]): string[] {
  if (!row) return [];
  return keys.filter((k) => {
    const val = row[k];
    return val !== null && val !== undefined && val !== '';
  });
}

// ─── Main functions ──────────────────────────────────────────────────────────

/**
 * Query all 6 ADN tables and return structured progress.
 */
export async function getAdnProgress(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<AdnProgress> {
  // Run all queries in parallel
  const [profileRes, strategiesRes, marketRes, competitorsRes, brandRes, referencesRes] =
    await Promise.all([
      supabase
        .from('workspace_profile')
        .select('business_description, brand_persona, avatar_description, main_offer, target_audience')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('workspace_strategies')
        .select('platform')
        .eq('workspace_id', workspaceId),
      supabase
        .from('workspace_market')
        .select('industry_state, audience_exposure, market_beliefs, burned_topics, current_trends, competitiveness, differentiator')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('workspace_competitors')
        .select('id')
        .eq('workspace_id', workspaceId),
      supabase
        .from('workspace_brand')
        .select('why_clients_choose, niche_language, niche_tools, filtering_words, new_mechanisms')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('workspace_references')
        .select('id')
        .eq('workspace_id', workspaceId),
    ]);

  // Log any query errors
  if (profileRes.error) console.error('[adn-progress] profile error:', profileRes.error);
  if (strategiesRes.error) console.error('[adn-progress] strategies error:', strategiesRes.error);
  if (marketRes.error) console.error('[adn-progress] market error:', marketRes.error);
  if (competitorsRes.error) console.error('[adn-progress] competitors error:', competitorsRes.error);
  if (brandRes.error) console.error('[adn-progress] brand error:', brandRes.error);
  if (referencesRes.error) console.error('[adn-progress] references error:', referencesRes.error);

  const profileFields = filledFields(
    profileRes.data as Record<string, unknown> | null,
    ['business_description', 'brand_persona', 'avatar_description', 'main_offer', 'target_audience']
  );
  const profileComplete = profileFields.length >= 5;

  const platforms = (strategiesRes.data ?? []).map((s: { platform: string }) => s.platform);
  const strategiesComplete = platforms.includes('instagram'); // at least IG strategy

  const marketFields = filledFields(
    marketRes.data as Record<string, unknown> | null,
    ['industry_state', 'audience_exposure', 'market_beliefs', 'burned_topics', 'current_trends', 'competitiveness', 'differentiator']
  );
  const marketComplete = marketFields.length >= 3;

  const competitorCount = competitorsRes.data?.length ?? 0;
  const competitorsComplete = competitorCount >= 1;

  const brandFields = filledFields(
    brandRes.data as Record<string, unknown> | null,
    ['why_clients_choose', 'niche_language', 'niche_tools', 'filtering_words', 'new_mechanisms']
  );
  const brandComplete = brandFields.length >= 4;

  const referenceCount = referencesRes.data?.length ?? 0;
  const referencesComplete = referenceCount >= 1;

  const overall_complete =
    profileComplete && strategiesComplete && marketComplete &&
    competitorsComplete && brandComplete && referencesComplete;

  // Determine current section (first incomplete one)
  let current_section: 1 | 2 | 3 | 4 = 1;
  if (profileComplete) current_section = 2;
  if (profileComplete && strategiesComplete) current_section = 3;
  if (profileComplete && strategiesComplete && marketComplete && competitorsComplete) current_section = 4;
  if (overall_complete) current_section = 4;

  return {
    sections: {
      profile: { complete: profileComplete, fields_filled: profileFields },
      strategies: { complete: strategiesComplete, platforms },
      market: { complete: marketComplete, fields_filled: marketFields },
      competitors: { complete: competitorsComplete, count: competitorCount },
      brand: { complete: brandComplete, fields_filled: brandFields },
      references: { complete: referencesComplete, count: referenceCount },
    },
    overall_complete,
    current_section,
  };
}

// ─── Raw data loader ────────────────────────────────────────────────────────

export interface AdnData {
  profile: Record<string, string | null> | null;
  strategies: Array<Record<string, string | null>>;
  market: Record<string, string | null> | null;
  competitors: Array<Record<string, string | null>>;
  brand: Record<string, string | null> | null;
  references: Array<Record<string, string | null>>;
}

/**
 * Load all raw ADN data for display in the docs panel.
 */
export async function getAdnData(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<AdnData> {
  const [profileRes, strategiesRes, marketRes, competitorsRes, brandRes, referencesRes] =
    await Promise.all([
      supabase
        .from('workspace_profile')
        .select('business_description, brand_persona, avatar_description, target_audience, main_offer')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('workspace_strategies')
        .select('platform, what_tested, test_results, conclusions, current_strategy, formats_and_quantity, why_it_will_work')
        .eq('workspace_id', workspaceId),
      supabase
        .from('workspace_market')
        .select('industry_state, audience_exposure, market_beliefs, burned_topics, current_trends, competitiveness, differentiator')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('workspace_competitors')
        .select('id, name, ig_url, why_better')
        .eq('workspace_id', workspaceId),
      supabase
        .from('workspace_brand')
        .select('why_clients_choose, niche_language, niche_tools, filtering_words, new_mechanisms')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('workspace_references')
        .select('id, brand_name, brand_url, what_they_like')
        .eq('workspace_id', workspaceId),
    ]);

  return {
    profile: (profileRes.data as Record<string, string | null>) ?? null,
    strategies: (strategiesRes.data as Array<Record<string, string | null>>) ?? [],
    market: (marketRes.data as Record<string, string | null>) ?? null,
    competitors: (competitorsRes.data as Array<Record<string, string | null>>) ?? [],
    brand: (brandRes.data as Record<string, string | null>) ?? null,
    references: (referencesRes.data as Array<Record<string, string | null>>) ?? [],
  };
}

/**
 * Mark onboarding as complete on the workspace.
 */
export async function markOnboardingComplete(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase
    .from('workspaces')
    .update({ onboarding_completed: true })
    .eq('id', workspaceId);
  if (error) console.error('[adn-progress] markOnboardingComplete error:', error);
}

/**
 * Find or create the ADN onboarding chat session.
 */
export async function getOrCreateAdnSession(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<string> {
  // Look for existing ADN session
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('title', 'ADN de Comunicación')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new session
  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      title: 'ADN de Comunicación',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create ADN session: ${error.message}`);
  return session.id;
}
