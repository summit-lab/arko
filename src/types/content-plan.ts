export type ContentType = 'reel' | 'carousel' | 'story' | 'youtube_video';

export type ContentStatus =
  | 'idea'
  | 'ready_to_record'
  | 'raw_footage'
  | 'editing'
  | 'ready_to_publish'
  | 'published';

export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube';

export interface ContentMetrics {
  reach?: number;
  likes?: number;
  saves?: number;
  comments?: number;
  shares?: number;
}

export interface ContentItem {
  id: string;
  workspace_id?: string;
  planned_date: string | null;
  title: string;
  description?: string | null;
  script?: string | null;
  reference_url?: string | null;
  raw_video_url?: string | null;
  edited_video_url?: string | null;
  platform: ContentPlatform;
  content_type: ContentType;
  status: ContentStatus;
  source_type?: 'manual' | 'ai_insight' | 'competitor_reel';
  source_ref?: string | null;
  metrics?: ContentMetrics | null;
  position?: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarReel {
  id: string;
  date: string;
  caption: string;
  type: 'reel' | 'carousel' | 'story';
  href?: string;
}

export interface ContentStatusMeta {
  value: ContentStatus;
  label: string;
  color: string;
  dot: string;
}

export const CONTENT_STATUSES: ContentStatusMeta[] = [
  { value: 'idea',             label: 'Idea',                color: 'rgba(255,255,255,0.06)', dot: 'rgba(180,180,180,0.6)' },
  { value: 'ready_to_record',  label: 'Listo para grabar',   color: 'rgba(139,92,246,0.12)',  dot: 'rgb(139,92,246)'       },
  { value: 'raw_footage',      label: 'Videos crudos',       color: 'rgba(251,146,60,0.12)',  dot: 'rgb(251,146,60)'       },
  { value: 'editing',          label: 'Editando',            color: 'rgba(59,130,246,0.12)',  dot: 'rgb(59,130,246)'       },
  { value: 'ready_to_publish', label: 'Listo para publicar', color: 'rgba(14,165,233,0.12)',  dot: 'rgb(14,165,233)'       },
  { value: 'published',        label: 'Publicado',           color: 'rgba(34,197,94,0.15)',   dot: 'rgb(34,197,94)'        },
];

export const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'reel',          label: 'Reel'             },
  { value: 'carousel',      label: 'Carrusel'         },
  { value: 'story',         label: 'Historia'         },
  { value: 'youtube_video', label: 'Video de YouTube' },
];

export const CONTENT_PLATFORMS: { value: ContentPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok'    },
  { value: 'youtube',   label: 'YouTube'   },
];
