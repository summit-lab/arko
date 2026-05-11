export type ContentType = 'reel' | 'carousel' | 'story';

export type ContentStatus =
  | 'idea'
  | 'script'
  | 'needs_recording'
  | 'recorded'
  | 'needs_editing'
  | 'editing'
  | 'scheduled'
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
  description: string | null;
  // Fields added by migration 100 — may be undefined before migration is applied
  script?: string | null;
  platform: ContentPlatform;
  content_type: ContentType;
  status: ContentStatus;
  source_type?: 'manual' | 'ai_insight' | 'competitor_reel';
  source_ref?: string | null;
  metrics?: ContentMetrics | null;
  created_at: string;
  updated_at: string;
}

// Published Instagram item shown in the calendar (read-only)
export interface CalendarReel {
  id: string;
  date: string;        // YYYY-MM-DD
  caption: string;
  type: 'reel' | 'carousel' | 'story';
  href?: string;       // navigation target on click
}

export interface ContentStatusMeta {
  value: ContentStatus;
  label: string;
  color: string;
  dot: string;
}

export const CONTENT_STATUSES: ContentStatusMeta[] = [
  { value: 'idea',            label: 'Idea',          color: 'rgba(255,255,255,0.06)', dot: 'rgba(255,255,255,0.3)' },
  { value: 'script',         label: 'Script',        color: 'rgba(139,92,246,0.12)',  dot: 'rgb(139,92,246)' },
  { value: 'needs_recording', label: 'Falta grabar',  color: 'rgba(251,146,60,0.12)', dot: 'rgb(251,146,60)' },
  { value: 'recorded',       label: 'Grabado',       color: 'rgba(34,197,94,0.10)',  dot: 'rgb(34,197,94)' },
  { value: 'needs_editing',  label: 'Falta editar',  color: 'rgba(251,146,60,0.12)', dot: 'rgb(251,146,60)' },
  { value: 'editing',        label: 'Editando',      color: 'rgba(59,130,246,0.12)', dot: 'rgb(59,130,246)' },
  { value: 'scheduled',      label: 'Programado',    color: 'rgba(14,165,233,0.12)', dot: 'rgb(14,165,233)' },
  { value: 'published',      label: 'Publicado',     color: 'rgba(34,197,94,0.15)',  dot: 'rgb(34,197,94)' },
];

export const CONTENT_TYPES: { value: ContentType; label: string; emoji: string }[] = [
  { value: 'reel',     label: 'Reel',     emoji: '🎬' },
  { value: 'carousel', label: 'Carrusel', emoji: '🖼️' },
  { value: 'story',    label: 'Historia', emoji: '📱' },
];

export const CONTENT_PLATFORMS: { value: ContentPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
];
