-- Migration 4: AI Pipeline tables
-- Creates: reel_transcripts, reel_narrative_analysis, reel_visual_analysis,
--          reel_audio_analysis, reel_diagnostics
-- PRD sections: 7.1-7.5, 9.2-9.3

-- =============================================================
-- REEL_TRANSCRIPTS — ASR output + cleaned transcript
-- PRD 7.2: Transcripción
-- =============================================================
CREATE TABLE reel_transcripts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id               uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Raw ASR output
  transcript_raw        text,

  -- LLM-cleaned transcript (coherent sentences)
  transcript_clean      text,

  -- Script lines as array (PRD: "guion legible, separado en líneas")
  transcript_lines      jsonb DEFAULT '[]',

  -- Timestamps per block/line
  timestamps_per_block  jsonb DEFAULT '[]',

  -- Processing metadata
  asr_provider          text DEFAULT 'whisper',
  asr_language          text DEFAULT 'es',
  processing_status     text NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  error_message         text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reel_id)
);

CREATE INDEX idx_reel_transcripts_reel ON reel_transcripts(reel_id);
CREATE INDEX idx_reel_transcripts_workspace ON reel_transcripts(workspace_id);
CREATE INDEX idx_reel_transcripts_status ON reel_transcripts(processing_status);

CREATE TRIGGER reel_transcripts_updated_at
  BEFORE UPDATE ON reel_transcripts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reel_transcripts ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- REEL_NARRATIVE_ANALYSIS — LLM analysis of script/narrative
-- PRD 7.3: Análisis narrativo
-- =============================================================
CREATE TABLE reel_narrative_analysis (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id                   uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id              uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Hook, development, CTA, closing (PRD 7.3)
  hook_text                 text,
  development_summary       text,
  cta_text                  text,
  closing_text              text,

  -- Core promise and topic (PRD 7.3)
  core_promise              text,
  topic_cluster             text,

  -- Language specificity (PRD 7.3)
  language_specificity      text CHECK (language_specificity IN ('high', 'medium', 'low')),
  niche_terms_detected      text[] DEFAULT '{}',

  -- CTA detection (PRD 7.3)
  has_cta                   boolean DEFAULT false,
  cta_type                  text,

  -- Processing metadata
  llm_model                 text DEFAULT 'gpt-4o',
  processing_status         text NOT NULL DEFAULT 'pending'
                            CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  error_message             text,
  tokens_used               int DEFAULT 0,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reel_id)
);

CREATE INDEX idx_reel_narrative_reel ON reel_narrative_analysis(reel_id);
CREATE INDEX idx_reel_narrative_workspace ON reel_narrative_analysis(workspace_id);
CREATE INDEX idx_reel_narrative_topic ON reel_narrative_analysis(topic_cluster);

CREATE TRIGGER reel_narrative_updated_at
  BEFORE UPDATE ON reel_narrative_analysis
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reel_narrative_analysis ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- REEL_VISUAL_ANALYSIS — Visual frame analysis
-- PRD 7.4: Análisis visual
-- =============================================================
CREATE TABLE reel_visual_analysis (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id                 uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Frame references (stored in Supabase Storage)
  frames_count            int DEFAULT 0,
  frame_paths             text[] DEFAULT '{}',

  -- Classification (PRD 7.4)
  orientation             text CHECK (orientation IN ('vertical', 'horizontal')),
  format_type             text,
  scene_type              text,
  background_context      text,
  text_on_screen          text,
  clothing_features       text,
  hat_detected            boolean,
  people_count            int,
  shot_type               text,

  -- First frame analysis (especially important per PRD)
  first_frame_has_text    boolean,
  first_frame_face_visible boolean,
  first_frame_hook_context text,

  -- Processing metadata
  vision_model            text DEFAULT 'gpt-4o',
  processing_status       text NOT NULL DEFAULT 'pending'
                          CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  error_message           text,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reel_id)
);

CREATE INDEX idx_reel_visual_reel ON reel_visual_analysis(reel_id);
CREATE INDEX idx_reel_visual_workspace ON reel_visual_analysis(workspace_id);

CREATE TRIGGER reel_visual_updated_at
  BEFORE UPDATE ON reel_visual_analysis
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reel_visual_analysis ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- REEL_AUDIO_ANALYSIS — Audio/delivery analysis
-- PRD 7.5: Análisis de audio / delivery
-- =============================================================
CREATE TABLE reel_audio_analysis (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id               uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Core metrics (PRD 7.5)
  words_total           int DEFAULT 0,
  speaking_rate_wpm     real DEFAULT 0,

  -- Phase 2 fields
  filler_density        real,
  pauses_estimate       int,

  -- Processing metadata
  processing_status     text NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  error_message         text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reel_id)
);

CREATE INDEX idx_reel_audio_reel ON reel_audio_analysis(reel_id);
CREATE INDEX idx_reel_audio_workspace ON reel_audio_analysis(workspace_id);

CREATE TRIGGER reel_audio_updated_at
  BEFORE UPDATE ON reel_audio_analysis
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reel_audio_analysis ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- REEL_DIAGNOSTICS — On-demand AI diagnoses
-- PRD 9.2-9.3: Diagnóstico IA bajo demanda
-- =============================================================
CREATE TABLE reel_diagnostics (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id                   uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  workspace_id              uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Diagnosis outputs (PRD 9.3)
  why_it_worked             text,
  why_it_didnt_work         text,
  hook_improvements         text,
  visual_improvements       text,
  cta_improvements          text,
  message_improvements      text,
  similarity_to_top         text,

  -- Full structured diagnosis
  full_diagnosis            jsonb DEFAULT '{}',

  -- Context snapshot used for grounding
  context_snapshot          jsonb DEFAULT '{}',

  -- Processing metadata
  llm_model                 text DEFAULT 'gpt-4o',
  tokens_used               int DEFAULT 0,
  processing_status         text NOT NULL DEFAULT 'pending'
                            CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  error_message             text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reel_diagnostics_reel ON reel_diagnostics(reel_id);
CREATE INDEX idx_reel_diagnostics_workspace ON reel_diagnostics(workspace_id);

CREATE TRIGGER reel_diagnostics_updated_at
  BEFORE UPDATE ON reel_diagnostics
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE reel_diagnostics ENABLE ROW LEVEL SECURITY;
