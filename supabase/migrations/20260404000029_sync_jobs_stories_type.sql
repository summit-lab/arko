-- Migration 29: Agregar stories_sync al check constraint de sync_jobs
ALTER TABLE sync_jobs DROP CONSTRAINT sync_jobs_job_type_check;
ALTER TABLE sync_jobs ADD CONSTRAINT sync_jobs_job_type_check CHECK (
  job_type = ANY (ARRAY[
    'ig_media','ig_insights','ads_insights','ad_mapping',
    'transcription','visual_analysis','narrative_analysis','audio_analysis',
    'benchmark_calc','full_sync','account_insights','stories_sync'
  ])
);
