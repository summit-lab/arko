/**
 * Arko Database Types — Generated from SQL schema
 * Maps 1:1 to Supabase tables defined in supabase/migrations/
 * PRD: docs/ARKO_PRD_INSTAGRAM_v1.md
 */

// ─── Enums ───────────────────────────────────────────────────

export type WorkspacePlan = 'demo' | 'standard' | 'pro';

// Duración del trial gratis que el admin asigna al crear la invitación.
export type TrialDays = 30 | 60 | 90;

export type MetaConnectionStatus = 'pending' | 'active' | 'expired' | 'revoked' | 'error';

export type ReelType = 'normal' | 'trial_likely' | 'unknown';

export type AttributionConfidence = 'none' | 'low' | 'medium' | 'high';

export type ReelSyncStatus = 'synced' | 'processing' | 'analyzed' | 'error';

export type AdMatchMethod = 'object_story_id' | 'creative_permalink' | 'permalink_match' | 'manual';

export type MatchConfidence = 'low' | 'medium' | 'high';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

export type LanguageSpecificity = 'high' | 'medium' | 'low';

export type ChatRole = 'user' | 'assistant' | 'system';

export type AuditActionType = 'chat_response' | 'reel_diagnosis' | 'reel_analysis' | 'sync_completed';

export type SyncJobType =
  | 'ig_media'
  | 'ig_insights'
  | 'ads_insights'
  | 'ad_mapping'
  | 'transcription'
  | 'visual_analysis'
  | 'narrative_analysis'
  | 'audio_analysis'
  | 'benchmark_calc'
  | 'full_sync';

export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type UserRole = 'admin' | 'user';

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export type InvitationStatus = 'pending' | 'used' | 'expired';

export type OnboardingPlatform = 'instagram' | 'youtube' | 'tiktok' | 'other';

// ─── Table Types ─────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  reels_limit: number;
  is_active: boolean;
  settings: Record<string, unknown>;
  // Trial gratis (30/60/90). Estampado al registrarse via invitación. null = sin trial.
  trial_days: TrialDays | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaConnection {
  id: string;
  workspace_id: string;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  token_type: string;
  fb_user_id: string | null;
  page_id: string | null;
  page_name: string | null;
  page_access_token_enc: string | null;
  ig_business_account_id: string | null;
  ig_username: string | null;
  ad_account_ids: string[];
  permissions_granted: string[];
  status: MetaConnectionStatus;
  last_error: string | null;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reel {
  id: string;
  workspace_id: string;
  ig_media_id: string;
  caption: string | null;
  media_type: string | null;
  media_product_type: string | null;
  permalink: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  is_shared_to_feed: boolean | null;
  published_at: string | null;
  duration_seconds: number | null;
  reel_type: ReelType;
  has_ads: boolean;
  attribution_confidence: AttributionConfidence;
  sync_status: ReelSyncStatus;
  media_storage_path: string | null;
  thumbnail_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReelMetrics {
  id: string;
  reel_id: string;
  workspace_id: string;
  views_org: number;
  impressions_org: number;
  reach_org: number;
  likes_total: number;
  comments_total: number;
  shares_total: number;
  saves_total: number;
  total_interactions: number;
  profile_visits: number | null;
  follows_generated: number | null;
  avg_watch_time_sec: number | null;
  completion_rate: number | null;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReelMetricsPaid {
  id: string;
  reel_id: string;
  workspace_id: string;
  views_paid: number;
  impressions_paid: number;
  reach_paid: number;
  clicks: number;
  spend_cents: number;
  video_plays: number;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdMapping {
  id: string;
  reel_id: string;
  workspace_id: string;
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_account_id: string | null;
  match_method: AdMatchMethod;
  match_confidence: MatchConfidence;
  impressions: number;
  reach: number;
  clicks: number;
  spend_cents: number;
  video_plays: number;
  object_story_id: string | null;
  creative_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReelBenchmark {
  id: string;
  workspace_id: string;
  calculated_at: string;
  window_start: string;
  window_end: string;
  reels_in_window: number;
  avg_views_90d: number;
  avg_comments_90d: number;
  avg_saves_90d: number;
  avg_follows_90d: number;
  avg_likes_90d: number;
  avg_shares_90d: number;
  avg_reach_90d: number;
  avg_watch_time_90d: number;
  avg_likes_per_view: number;
  avg_comments_per_view: number;
  avg_shares_per_view: number;
  avg_saves_per_view: number;
  avg_follows_per_view: number;
  avg_engagement_rate: number;
  avg_retention_rate: number;
  avg_duration_seconds: number;
  avg_reach_per_view: number;
  avg_saves_per_reach: number;
  exclude_trials: boolean;
  min_views_threshold: number;
  created_at: string;
}

export interface ReelTranscript {
  id: string;
  reel_id: string;
  workspace_id: string;
  transcript_raw: string | null;
  transcript_clean: string | null;
  transcript_lines: TranscriptLine[];
  timestamps_per_block: TimestampBlock[];
  asr_provider: string;
  asr_language: string;
  processing_status: ProcessingStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptLine {
  index: number;
  text: string;
  label?: 'hook' | 'development' | 'cta' | 'closing';
}

export interface TimestampBlock {
  start_sec: number;
  end_sec: number;
  text: string;
}

export interface ReelNarrativeAnalysis {
  id: string;
  reel_id: string;
  workspace_id: string;
  hook_text: string | null;
  development_summary: string | null;
  cta_text: string | null;
  closing_text: string | null;
  core_promise: string | null;
  topic_cluster: string | null;
  language_specificity: LanguageSpecificity | null;
  niche_terms_detected: string[];
  has_cta: boolean;
  cta_type: string | null;
  llm_model: string;
  processing_status: ProcessingStatus;
  error_message: string | null;
  tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface ReelVisualAnalysis {
  id: string;
  reel_id: string;
  workspace_id: string;
  frames_count: number;
  frame_paths: string[];
  orientation: 'vertical' | 'horizontal' | null;
  format_type: string | null;
  scene_type: string | null;
  background_context: string | null;
  text_on_screen: string | null;
  clothing_features: string | null;
  hat_detected: boolean | null;
  people_count: number | null;
  shot_type: string | null;
  first_frame_has_text: boolean | null;
  first_frame_face_visible: boolean | null;
  first_frame_hook_context: string | null;
  vision_model: string;
  processing_status: ProcessingStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReelAudioAnalysis {
  id: string;
  reel_id: string;
  workspace_id: string;
  words_total: number;
  speaking_rate_wpm: number;
  filler_density: number | null;
  pauses_estimate: number | null;
  processing_status: ProcessingStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReelDiagnostic {
  id: string;
  reel_id: string;
  workspace_id: string;
  why_it_worked: string | null;
  why_it_didnt_work: string | null;
  hook_improvements: string | null;
  visual_improvements: string | null;
  cta_improvements: string | null;
  message_improvements: string | null;
  similarity_to_top: string | null;
  full_diagnosis: Record<string, unknown>;
  context_snapshot: Record<string, unknown>;
  llm_model: string;
  tokens_used: number;
  processing_status: ProcessingStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  is_active: boolean;
  context_reel_ids: string[];
  total_tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  workspace_id: string;
  role: ChatRole;
  content: string;
  grounding_data: Record<string, unknown>;
  referenced_reels: string[];
  tokens_used: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  user_id: string;
  action_type: AuditActionType;
  entity_type: string | null;
  entity_id: string | null;
  request_summary: string | null;
  response_summary: string | null;
  evidence_used: Record<string, unknown>;
  llm_model: string | null;
  tokens_used: number;
  latency_ms: number | null;
  created_at: string;
}

export interface SyncJob {
  id: string;
  workspace_id: string;
  job_type: SyncJobType;
  status: SyncJobStatus;
  total_items: number;
  processed_items: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  error_details: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  workspace_id: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  default_language: 'es' | 'en';
  // Trial gratis (30/60/90) que recibirá el usuario al registrarse con esta invitación.
  trial_days: TrialDays;
  created_at: string;
}

export interface WorkspaceProfile {
  id: string;
  workspace_id: string;
  business_description: string | null;
  brand_persona: string | null;
  avatar_description: string | null;
  main_offer: string | null;
  target_audience: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceStrategy {
  id: string;
  workspace_id: string;
  platform: OnboardingPlatform;
  what_tested: string | null;
  test_results: string | null;
  conclusions: string | null;
  current_strategy: string | null;
  formats_and_quantity: string | null;
  why_it_will_work: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceCompetitor {
  id: string;
  workspace_id: string;
  name: string | null;
  ig_url: string | null;
  why_better: string | null;
  scraped_data: Record<string, unknown>;
  last_scraped_at: string | null;
  created_at: string;
}

export interface WorkspaceMarket {
  id: string;
  workspace_id: string;
  industry_state: string | null;
  audience_exposure: string | null;
  market_beliefs: string | null;
  burned_topics: string | null;
  current_trends: string | null;
  competitiveness: string | null;
  differentiator: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceReference {
  id: string;
  workspace_id: string;
  brand_name: string | null;
  brand_url: string | null;
  what_they_like: string | null;
  created_at: string;
}

export interface WorkspaceBrand {
  id: string;
  workspace_id: string;
  why_clients_choose: string | null;
  niche_language: string | null;
  niche_tools: string | null;
  filtering_words: string | null;
  new_mechanisms: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Computed View Types ─────────────────────────────────────

export interface ReelComputed {
  reel_id: string;
  workspace_id: string;
  views_org: number;
  views_paid: number;
  views_total: number;
  impressions_total: number;
  reach_total: number;
  likes_total: number;
  comments_total: number;
  shares_total: number;
  saves_total: number;
  likes_per_view: number;
  comments_per_view: number;
  shares_per_view: number;
  saves_per_view: number;
  views_per_impression: number;
  follows_per_view: number;
  retention_ratio: number | null;
}

// ─── Composite Types (for API responses) ─────────────────────

/** Full reel detail as described in PRD 8.2 (Ficha de Reel) */
export interface ReelDetail extends Reel {
  metrics: ReelMetrics | null;
  metrics_paid: ReelMetricsPaid | null;
  computed: ReelComputed | null;
  transcript: ReelTranscript | null;
  narrative: ReelNarrativeAnalysis | null;
  visual: ReelVisualAnalysis | null;
  audio: ReelAudioAnalysis | null;
  diagnostics: ReelDiagnostic[];
  ad_mappings: AdMapping[];
  benchmark: ReelBenchmark | null;
  performer_multiple_views: number | null;
  is_top_performer: boolean;
}

/** Reel card for dashboard grid (PRD 8.1) */
export interface ReelCard {
  id: string;
  ig_media_id: string;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  reel_type: ReelType;
  has_ads: boolean;
  views_total: number;
  views_org: number;
  views_paid: number;
  performer_multiple: number | null;
  is_top_performer: boolean;
}

/** Dashboard aggregated stats */
export interface DashboardStats {
  total_reels: number;
  total_views: number;
  avg_views: number;
  total_views_org: number;
  total_views_paid: number;
  top_performers_count: number;
  benchmark: ReelBenchmark | null;
}
