/**
 * arko-ai-context.ts
 * Tool definitions and execution for Arko AI.
 * Claude decides what data it needs via tool_use, and we execute the queries.
 *
 * Includes a workspace snapshot cache (ADN + benchmarks + top topics)
 * that is pre-loaded into the system prompt. Invalidated via invalidateWorkspaceCache().
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMTool } from './llm.service';
import { getAdnData } from './adn-progress.service';
import { callSpecialist, SPECIALIST_DESCRIPTIONS, type SpecialistDomain, type SpecialistResult } from './arko-ai-specialists';
import type { PromptLocale } from './arko-ai-prompts';

// ─── Workspace snapshot cache ────────────────────────────────────────────────
// Caches ADN + benchmarks + top topic clusters so we don't re-query on every message.
// TTL: 30 min or until explicitly invalidated by ADN/benchmark writes.

interface WorkspaceSnapshot {
  adnContext: string;
  benchmarksContext: string;
  topTopicsContext: string;
  cachedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const snapshotCache = new Map<string, WorkspaceSnapshot>();

/** Call this when ADN data or benchmarks change to force a fresh load. */
export function invalidateWorkspaceCache(workspaceId: string): void {
  snapshotCache.delete(workspaceId);
}

/**
 * Loads the full workspace snapshot (ADN + benchmarks + top topics).
 * Cached in memory for 30min. Returns { adnContext, benchmarksContext, topTopicsContext }.
 */
export async function loadWorkspaceSnapshot(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<WorkspaceSnapshot> {
  const cached = snapshotCache.get(workspaceId);
  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return cached;
  }

  // Load ADN + benchmarks + top topics in parallel
  const [adnContext, benchmarksContext, topTopicsContext] = await Promise.all([
    loadAdnContext(supabase, workspaceId),
    loadBenchmarksContext(supabase, workspaceId),
    loadTopTopicsContext(supabase, workspaceId),
  ]);

  const snapshot: WorkspaceSnapshot = {
    adnContext,
    benchmarksContext,
    topTopicsContext,
    cachedAt: Date.now(),
  };

  snapshotCache.set(workspaceId, snapshot);
  return snapshot;
}

// ─── Message complexity classification ────────────────────────────────────────
// Determines whether a message needs Claude (deep analysis) or can be handled
// by a lighter model (GPT-5.1-mini) for simple conversational responses.

/** Keywords that signal the user needs data analysis → Claude */
const COMPLEX_KEYWORDS = [
  // Metrics & analysis
  'métrica', 'metricas', 'benchmark', 'rendimiento', 'performance', 'views', 'likes',
  'saves', 'guardados', 'shares', 'compartidos', 'engagement', 'retención', 'retencion',
  'promedio', 'average', 'comparar', 'comparación', 'comparacion', 'análisis', 'analisis',
  'analizar', 'analizá', 'analiza', 'diagnostico', 'diagnóstico',
  // Content creation
  'idea', 'ideas', 'reel', 'reels', 'guion', 'guión', 'script', 'hook', 'hooks',
  'cta', 'concepto', 'conceptos', 'contenido', 'formato',
  // Strategy & audience
  'estrategia', 'competencia', 'competidor', 'competidores', 'tendencia', 'tendencias',
  'tema', 'temas', 'cluster', 'nicho', 'audiencia', 'seguidor', 'seguidores', 'followers',
  'demograf', 'género', 'genero', 'edad', 'país', 'pais', 'ciudad', 'idioma',
  'frecuencia', 'consistencia', 'publicar', 'publico', 'publicando', 'calendario',
  // Actions that need tools
  'mejor reel', 'peor reel', 'top', 'ranking', 'buscar', 'buscá', 'busca',
  'último', 'últimos', 'ultimo', 'ultimos', 'mes', 'semana', 'días', 'dias',
  'pauta', 'orgánico', 'organico', 'pago', 'ads',
  // Deep analysis
  'por qué', 'por que', 'cómo mejorar', 'como mejorar', 'qué funciona', 'que funciona',
  'qué hago', 'que hago', 'recomiend', 'suger', 'evalua', 'evaluá',
];

/** Patterns that are clearly simple/conversational → GPT-5.1-mini */
const SIMPLE_PATTERNS = [
  /^(hola|hey|buenas|buen día|buenos días|qué tal|que tal|qué onda|que onda)/i,
  /^(gracias|genial|perfecto|dale|ok|okey|entendido|claro|buenísimo|buenisimo|excelente)/i,
  /^(chau|nos vemos|hasta luego|bye)/i,
  /^(qué sos|que sos|quién sos|quien sos|qué podés|que podes|qué hacés|que haces|cómo funciona|como funciona)/i,
  /^(cuál es mi|cual es mi).*(negocio|marca|nicho|avatar|oferta|mercado)/i,
  /^(contame|decime|explicame|qué es|que es).*(adn|arko|marca|perfil)/i,
];

export type MessageComplexity = 'simple' | 'complex';

/**
 * Classifies whether a message needs deep analysis (Claude) or simple conversation (GPT).
 * Checks the current message + recent history for context.
 */
export function classifyMessageComplexity(
  message: string,
  recentMessages?: string[]
): MessageComplexity {
  const lower = message.toLowerCase().trim();

  // Check if it matches a clearly simple pattern
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(lower)) return 'simple';
  }

  // Check for complex keywords in the message
  for (const keyword of COMPLEX_KEYWORDS) {
    if (lower.includes(keyword)) return 'complex';
  }

  // Check recent history — if the conversation already involved tools/analysis,
  // follow-up messages are likely complex too
  if (recentMessages && recentMessages.length > 0) {
    const recentContext = recentMessages.slice(-3).join(' ').toLowerCase();
    for (const keyword of COMPLEX_KEYWORDS) {
      if (recentContext.includes(keyword)) return 'complex';
    }
  }

  // Short messages without keywords are likely conversational
  if (lower.split(/\s+/).length <= 5) return 'simple';

  // Default: complex (safer — Claude handles it better)
  return 'complex';
}

// ─── Tool definitions (sent to Claude) ───────────────────────────────────────

export const ARKO_TOOLS: LLMTool[] = [
  {
    name: 'query_reels',
    description: 'Busca reels del usuario con métricas, filtrados y ordenados. Úsala cuando el usuario pregunte sobre sus reels, contenido, métricas, rendimiento, hooks, o patrones.',
    input_schema: {
      type: 'object',
      properties: {
        order_by: {
          type: 'string',
          enum: ['views', 'likes', 'comments', 'shares', 'saves', 'follows', 'watch_time', 'published_at'],
          description: 'Campo para ordenar. Default: published_at (más recientes primero)',
        },
        order_direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Dirección del orden. Default: desc',
        },
        limit: {
          type: 'number',
          description: 'Cantidad de reels a devolver (max 30). Default: 10',
        },
        has_ads: {
          type: 'boolean',
          description: 'Filtrar por reels con/sin ads. Omitir para todos.',
        },
        days_back: {
          type: 'number',
          description: 'Solo reels de los últimos N días. Omitir para todos.',
        },
        min_views: {
          type: 'number',
          description: 'Solo reels con al menos N views orgánicos.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_reel_details',
    description: 'Obtiene TODOS los datos de un reel específico: métricas, transcript, análisis narrativo, análisis visual, análisis de audio, diagnóstico AI. Úsala cuando el usuario pregunte por un reel específico o quieras profundizar.',
    input_schema: {
      type: 'object',
      properties: {
        reel_id: {
          type: 'string',
          description: 'UUID del reel',
        },
      },
      required: ['reel_id'],
    },
  },
  {
    name: 'get_account_insights',
    description: 'Obtiene métricas de cuenta de Instagram: followers totales, crecimiento de seguidores, reach, impressions, profile views, website clicks, email contacts, etc. Úsala cuando el usuario pregunte sobre seguidores, crecimiento, alcance general, o métricas de cuenta (NO de reels individuales).',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Cantidad de días hacia atrás. Default: 30',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_content_calendar',
    description: 'Analiza la frecuencia y patrones de publicación del usuario: posts por semana, días más activos, horarios preferidos, gaps de publicación (días sin publicar), racha actual. Úsala cuando el usuario pregunte sobre consistencia, frecuencia, cuándo publica, o si está publicando poco.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Período de análisis en días. Default: 30',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_audience_demographics',
    description: 'Obtiene datos demográficos de la audiencia del usuario: género (M/F), rangos de edad, top ciudades, top países, idiomas. Úsala cuando el usuario pregunte sobre su audiencia, quién lo ve, de dónde son sus seguidores, o datos demográficos.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'compare_periods',
    description: 'Compara dos períodos de tiempo para ver evolución de métricas: views, reach, impressions, engagement, followers, publicaciones. Úsala cuando el usuario pregunte "¿mejoré?", "¿cómo vengo vs el mes pasado?", "comparame esta semana vs la anterior", o cualquier comparación temporal.',
    input_schema: {
      type: 'object',
      properties: {
        period_days: {
          type: 'number',
          description: 'Duración de cada período en días. Default: 30 (compara últimos 30d vs 30d anteriores)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_benchmarks',
    description: 'Obtiene los benchmarks promedio del workspace (90 días): views, likes, comments, shares, saves, engagement rate, retención, duración. Úsala cuando necesites comparar métricas o dar contexto de rendimiento.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_goals',
    description: 'Obtiene las metas mensuales del usuario (views, followers, engagement, etc.) y permite comparar con el rendimiento actual.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_reels_by_topic',
    description: 'Busca reels por tema, hook o contenido del caption/transcript. Úsala cuando el usuario pregunte sobre un tema específico ("¿tengo reels sobre pricing?", "reels donde hablo de errores").',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto a buscar en captions, hooks y transcripts',
        },
        limit: {
          type: 'number',
          description: 'Max resultados. Default: 10',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_top_hooks',
    description: 'Obtiene los hooks (textos de los primeros 2-3 segundos) de los reels con mejor rendimiento. Úsala para inspiración de hooks o análisis de patrones de apertura.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Cantidad de hooks. Default: 10',
        },
        metric: {
          type: 'string',
          enum: ['views', 'saves', 'shares', 'engagement'],
          description: 'Métrica para rankear. Default: views',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_topic_clusters',
    description: 'Obtiene los clusters de temas detectados en los reels con métricas promedio por cluster. Úsala para entender qué temas funcionan mejor.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_competitor_analysis',
    description: 'Obtiene datos de competidores del workspace: perfil de Instagram, reels scrapeados, y análisis AI de sus reels (hooks, estilo, estructura, CTA, fortalezas/debilidades). Úsala cuando el usuario pregunte sobre su competencia, quiera comparar su contenido vs competidores, o necesite inspiración de lo que hacen otros.',
    input_schema: {
      type: 'object',
      properties: {
        competitor_name: {
          type: 'string',
          description: 'Nombre del competidor a consultar. Omitir para ver todos.',
        },
        include_reels: {
          type: 'boolean',
          description: 'Si incluir los reels scrapeados y su análisis. Default: true',
        },
        top_n: {
          type: 'number',
          description: 'Cantidad de top reels por competidor. Default: 5',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_pipeline_items',
    description: 'Lista los items actuales de la Mesa de Trabajo (pipeline de contenido). Úsala ANTES de update_content_item para obtener los IDs, o cuando el usuario pregunte qué hay en su pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['idea', 'ready_to_record', 'raw_footage', 'editing', 'ready_to_publish', 'published'],
          description: 'Filtrar por estado (opcional)',
        },
      },
      required: [],
    },
  },
  {
    name: 'add_content_to_pipeline',
    description: 'Agrega uno o más ideas/contenidos a la Mesa de Trabajo del usuario. Úsala cuando pida "agregar al pipeline", "generame ideas de contenido", "planificame contenido para esta semana", "creame un plan de reels", etc. Podés agregar varios items de una sola vez.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Items a agregar al pipeline',
          items: {
            type: 'object',
            properties: {
              title:        { type: 'string', description: 'Título del contenido (obligatorio)' },
              content_type: { type: 'string', enum: ['reel', 'carousel', 'story', 'youtube_video'], description: 'Tipo. Default: reel' },
              platform:     { type: 'string', enum: ['instagram', 'tiktok', 'youtube'], description: 'Plataforma. Default: instagram' },
              status:       { type: 'string', enum: ['idea', 'ready_to_record', 'raw_footage', 'editing', 'ready_to_publish', 'published'], description: 'Estado inicial. Default: idea' },
              planned_date: { type: 'string', description: 'Fecha YYYY-MM-DD. Opcional.' },
              script:       { type: 'string', description: 'Guion del contenido. Opcional.' },
            },
            required: ['title'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'update_content_item',
    description: 'Edita metadata de un item de la Mesa de Trabajo (estado, tipo, plataforma, fecha). NO usar para modificar `script` ni `title` — para eso usá `propose_script_change`, que pide confirmación al usuario antes de aplicar.',
    input_schema: {
      type: 'object',
      properties: {
        id:           { type: 'string', description: 'UUID del item (obligatorio)' },
        status:       { type: 'string', enum: ['idea', 'ready_to_record', 'raw_footage', 'editing', 'ready_to_publish', 'published'], description: 'Nuevo estado (opcional)' },
        content_type: { type: 'string', enum: ['reel', 'carousel', 'story', 'youtube_video'], description: 'Tipo (opcional)' },
        platform:     { type: 'string', enum: ['instagram', 'tiktok', 'youtube'], description: 'Plataforma (opcional)' },
        planned_date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'propose_script_change',
    description: 'Propone una modificación al script (guion) o al título de un item. CRÍTICO: NO aplica el cambio directamente — crea una propuesta que el usuario aprueba o rechaza desde la UI con un diff visual. Usá esta tool SIEMPRE que quieras reescribir, mejorar o modificar el contenido textual de un guion. El usuario va a ver tu propuesta lado a lado con su versión actual antes de aplicarla. Después de proponer, explicá brevemente qué cambiaste y esperá la decisión del usuario — NO asumas que se aplicó.',
    input_schema: {
      type: 'object',
      properties: {
        id:              { type: 'string', description: 'UUID del item (obligatorio)' },
        proposed_script: { type: 'string', description: 'Guion propuesto completo. HTML (con <p>, <h1>, <h2>, <ul>, <li>, <strong>, <em>, <u>) o texto plano.' },
        proposed_title:  { type: 'string', description: 'Título propuesto (opcional, solo si querés cambiarlo)' },
        rationale:       { type: 'string', description: 'Nota corta (1-2 oraciones) describiendo qué cambiaste y por qué. Se muestra al usuario en el preview.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_content_item',
    description: 'Obtiene el detalle COMPLETO de un item de la Mesa de Trabajo por su ID (título, estado, fecha, guion completo, links). Úsala cuando el usuario te pida revisar, mejorar o trabajar sobre un guion específico, especialmente si estás operando en el contexto de un guion activo (el ID viene en el system prompt como CONTEXTO DEL GUION ACTIVO).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID del item (obligatorio)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_content_item',
    description: 'Elimina un item de la Mesa de Trabajo. Usá esta tool solo cuando el usuario lo pida explícitamente ("borrá esta idea", "eliminá este reel del pipeline"). Es una acción destructiva e irreversible — NO la uses para "limpiar" o "reordenar" sin pedido explícito.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID del item a eliminar (obligatorio)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'move_content_item',
    description: 'Mueve un item de la Mesa de Trabajo a otra columna (cambia su estado). Atajo semántico para "mové X a editando", "pasá X a publicado", "movelo a ideas". Usá list_pipeline_items primero para obtener el ID si no lo tenés.',
    input_schema: {
      type: 'object',
      properties: {
        id:         { type: 'string', description: 'UUID del item a mover (obligatorio)' },
        new_status: { type: 'string', enum: ['idea', 'ready_to_record', 'raw_footage', 'editing', 'ready_to_publish', 'published'], description: 'Columna destino (obligatorio)' },
      },
      required: ['id', 'new_status'],
    },
  },
  {
    name: 'consult_specialist',
    description: `Consulta a un sub-agente especializado para análisis profundo. Úsala cuando necesites ir más allá de un análisis superficial. Cada especialista tiene el framework COMPLETO de Francisco Doglio para su dominio.

Especialistas disponibles:
- hook_expert: ${SPECIALIST_DESCRIPTIONS.hook_expert}
- content_strategist: ${SPECIALIST_DESCRIPTIONS.content_strategist}
- metrics_analyst: ${SPECIALIST_DESCRIPTIONS.metrics_analyst}
- cta_expert: ${SPECIALIST_DESCRIPTIONS.cta_expert}
- concept_evaluator: ${SPECIALIST_DESCRIPTIONS.concept_evaluator}

CUÁNDO USAR: Siempre que el usuario pida análisis profundo, ideas, evaluación de conceptos, diagnóstico detallado de métricas, análisis de hooks/CTAs, o estrategia de contenido. NO la uses para preguntas simples que puedas responder con los datos directamente.`,
    input_schema: {
      type: 'object',
      properties: {
        specialist: {
          type: 'string',
          enum: ['hook_expert', 'content_strategist', 'metrics_analyst', 'cta_expert', 'concept_evaluator'],
          description: 'Qué especialista consultar',
        },
        question: {
          type: 'string',
          description: 'La pregunta o tarea específica para el especialista. Incluí todo el contexto relevante: qué pidió el usuario, datos de reels si aplica, métricas relevantes, etc.',
        },
        context_data: {
          type: 'string',
          description: 'Datos adicionales relevantes para el análisis (métricas, hooks, captions, benchmarks, etc.). Pegá acá los resultados de herramientas anteriores que sean relevantes.',
        },
      },
      required: ['specialist', 'question'],
    },
  },
];

// ─── Tool execution ──────────────────────────────────────────────────────────

const ORDER_COLUMN_MAP: Record<string, string> = {
  views: 'reel_metrics.views_org',
  likes: 'reel_metrics.likes_total',
  comments: 'reel_metrics.comments_total',
  shares: 'reel_metrics.shares_total',
  saves: 'reel_metrics.saves_total',
  follows: 'reel_metrics.follows_generated',
  watch_time: 'reel_metrics.avg_watch_time_sec',
  published_at: 'published_at',
};

export interface ArkoToolResult {
  result: string;
  specialistUsed?: SpecialistResult;
  contentAdded?: Record<string, unknown>[];
  contentUpdated?: Record<string, unknown>;
  contentDeleted?: { id: string };
  scriptChangePending?: Record<string, unknown>;
}

export async function executeArkoTool(
  supabase: SupabaseClient,
  workspaceId: string,
  toolName: string,
  input: Record<string, unknown>,
  adnContext?: string,
  locale: PromptLocale = 'es'
): Promise<ArkoToolResult> {
  switch (toolName) {
    case 'query_reels': {
      // Load benchmark for enriching reels with vs_benchmark ratios
      const { data: bench } = await supabase
        .from('reel_benchmarks')
        .select('avg_views_90d, avg_likes_90d, avg_comments_90d, avg_shares_90d, avg_saves_90d, avg_saves_per_view, avg_engagement_rate')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      return { result: await queryReels(supabase, workspaceId, input, bench as Record<string, number> | null) };
    }
    case 'get_reel_details':
      return { result: await getReelDetails(supabase, workspaceId, input.reel_id as string) };
    case 'get_account_insights':
      return { result: await getAccountInsights(supabase, workspaceId, (input.days as number) ?? 30) };
    case 'get_content_calendar':
      return { result: await getContentCalendar(supabase, workspaceId, (input.days as number) ?? 30) };
    case 'get_audience_demographics':
      return { result: await getAudienceDemographics(supabase, workspaceId) };
    case 'compare_periods':
      return { result: await comparePeriods(supabase, workspaceId, (input.period_days as number) ?? 30) };
    case 'get_benchmarks':
      return { result: await getBenchmarks(supabase, workspaceId) };
    case 'get_goals':
      return { result: await getGoals(supabase, workspaceId) };
    case 'search_reels_by_topic':
      return { result: await searchReelsByTopic(supabase, workspaceId, input.query as string, (input.limit as number) ?? 10) };
    case 'get_top_hooks':
      return { result: await getTopHooks(supabase, workspaceId, (input.limit as number) ?? 10, (input.metric as string) ?? 'views') };
    case 'get_topic_clusters':
      return { result: await getTopicClusters(supabase, workspaceId) };
    case 'get_competitor_analysis':
      return { result: await getCompetitorAnalysis(supabase, workspaceId, input) };
    case 'consult_specialist': {
      const specialist = input.specialist as SpecialistDomain;
      const question = input.question as string;
      const contextData = (input.context_data as string) ?? '';
      const specialistResult = await callSpecialist(
        specialist,
        question,
        contextData,
        adnContext ?? (locale === 'en' ? '_DNA not available._' : '_ADN no disponible._'),
        locale
      );
      return {
        result: JSON.stringify({
          specialist: specialistResult.domain,
          analysis: specialistResult.analysis,
        }),
        specialistUsed: specialistResult,
      };
    }
    case 'list_pipeline_items': {
      const statusFilter = input.status as string | undefined;
      let query = supabase
        .from('content_plan')
        .select('id, title, description, content_type, platform, status, planned_date, script, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (statusFilter) query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) return { result: JSON.stringify({ error: error.message }) };
      return { result: JSON.stringify({ total: data?.length ?? 0, items: data ?? [] }) };
    }
    case 'add_content_to_pipeline': {
      const rawItems = (input.items ?? []) as Array<Record<string, unknown>>;
      const today = new Date().toISOString().slice(0, 10);
      const rows = rawItems
        .map((item) => ({
          workspace_id: workspaceId,
          title: String(item.title ?? '').trim(),
          description: item.description ? String(item.description).trim() : null,
          content_type: item.content_type ?? 'reel',
          platform: item.platform ?? 'instagram',
          status: item.status ?? 'idea',
          planned_date: item.planned_date ?? today,
          script: item.script ? String(item.script).trim() : null,
          source_type: 'ai_insight',
        }))
        .filter((r) => r.title.length > 0);
      if (rows.length === 0) return { result: JSON.stringify({ error: 'No hay items válidos para insertar' }) };
      const { data, error } = await supabase
        .from('content_plan')
        .insert(rows)
        .select('id, title, description, content_type, platform, status, planned_date, script, source_type, source_ref, metrics, created_at, updated_at, workspace_id');
      if (error) return { result: JSON.stringify({ error: error.message }) };
      return {
        result: JSON.stringify({ added: data?.length ?? 0, titles: data?.map((i) => (i as Record<string, unknown>).title) }),
        contentAdded: (data ?? []) as Record<string, unknown>[],
      };
    }
    case 'update_content_item': {
      const id = input.id as string;
      if (!id) return { result: JSON.stringify({ error: 'id requerido' }) };
      // SOLO metadata. script/title destructivos van por propose_script_change.
      const allowedFields = ['description', 'status', 'content_type', 'platform', 'planned_date'] as const;
      const updates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (input[key] !== undefined) updates[key] = input[key];
      }
      if (input.script !== undefined || input.title !== undefined) {
        return {
          result: JSON.stringify({
            error: 'Para modificar script o title usá propose_script_change (el usuario tiene que aprobar el cambio en un preview).',
          }),
        };
      }
      if (Object.keys(updates).length === 0) return { result: JSON.stringify({ error: 'Nada que actualizar' }) };
      const { data, error } = await supabase
        .from('content_plan')
        .update(updates)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select('id, title, description, content_type, platform, status, planned_date, script, source_type, source_ref, metrics, created_at, updated_at, workspace_id')
        .single();
      if (error) return { result: JSON.stringify({ error: error.message }) };
      return {
        result: JSON.stringify({ updated: true, title: (data as Record<string, unknown>)?.title }),
        contentUpdated: data as Record<string, unknown>,
      };
    }
    case 'propose_script_change': {
      const id = input.id as string;
      if (!id) return { result: JSON.stringify({ error: 'id requerido' }) };
      const proposedScript = input.proposed_script as string | undefined;
      const proposedTitle  = input.proposed_title  as string | undefined;
      const rationale      = input.rationale        as string | undefined;
      if (proposedScript === undefined && proposedTitle === undefined) {
        return { result: JSON.stringify({ error: 'Hay que proponer al menos proposed_script o proposed_title' }) };
      }

      // Cargar item actual para snapshot del base
      const { data: current, error: currErr } = await supabase
        .from('content_plan')
        .select('id, title, script')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (currErr || !current) return { result: JSON.stringify({ error: 'Item no encontrado' }) };

      const baseScript = (current as { script?: string | null }).script ?? null;
      const baseTitle  = (current as { title?: string | null }).title  ?? null;

      // Si la propuesta es idéntica al actual, no crear pending
      const willChangeScript = proposedScript !== undefined && proposedScript !== baseScript;
      const willChangeTitle  = proposedTitle  !== undefined && proposedTitle  !== baseTitle;
      if (!willChangeScript && !willChangeTitle) {
        return { result: JSON.stringify({ error: 'La propuesta es idéntica a la versión actual.' }) };
      }

      const { data: pending, error: pendingErr } = await supabase
        .from('content_plan_pending_changes')
        .insert({
          content_plan_id: id,
          workspace_id: workspaceId,
          base_script:    baseScript,
          base_title:     baseTitle,
          proposed_script: willChangeScript ? proposedScript : baseScript,
          proposed_title:  willChangeTitle  ? proposedTitle  : baseTitle,
          proposed_by_kind: 'moka',
          rationale: rationale ?? null,
        })
        .select('id, content_plan_id, base_script, base_title, proposed_script, proposed_title, rationale, created_at, expires_at')
        .single();

      if (pendingErr) return { result: JSON.stringify({ error: pendingErr.message }) };

      return {
        result: JSON.stringify({
          proposed: true,
          pending_id: (pending as Record<string, unknown>)?.id,
          note: 'Propuesta creada. El usuario va a ver un preview con diff y decidir si aplicar o descartar. No asumas que se aplicó — esperá la decisión del usuario.',
        }),
        scriptChangePending: pending as Record<string, unknown>,
      };
    }
    case 'get_content_item': {
      const id = input.id as string;
      if (!id) return { result: JSON.stringify({ error: 'id requerido' }) };
      const { data, error } = await supabase
        .from('content_plan')
        .select('id, title, description, content_type, platform, status, planned_date, script, reference_url, raw_video_url, edited_video_url, source_type, source_ref, metrics, created_at, updated_at')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) return { result: JSON.stringify({ error: error.message }) };
      if (!data) return { result: JSON.stringify({ error: 'Item no encontrado' }) };
      return { result: JSON.stringify(data) };
    }
    case 'move_content_item': {
      const id = input.id as string;
      const newStatus = input.new_status as string;
      if (!id || !newStatus) return { result: JSON.stringify({ error: 'id y new_status son obligatorios' }) };
      const { data, error } = await supabase
        .from('content_plan')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select('id, title, description, content_type, platform, status, planned_date, script, source_type, source_ref, metrics, created_at, updated_at, workspace_id')
        .single();
      if (error) return { result: JSON.stringify({ error: error.message }) };
      return {
        result: JSON.stringify({ moved: true, title: (data as Record<string, unknown>)?.title, new_status: newStatus }),
        contentUpdated: data as Record<string, unknown>,
      };
    }
    case 'delete_content_item': {
      const id = input.id as string;
      if (!id) return { result: JSON.stringify({ error: 'id requerido' }) };
      const { data: existing, error: fetchError } = await supabase
        .from('content_plan')
        .select('id, title')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (fetchError) return { result: JSON.stringify({ error: fetchError.message }) };
      if (!existing) return { result: JSON.stringify({ error: 'Item no encontrado' }) };
      const { error } = await supabase
        .from('content_plan')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId);
      if (error) return { result: JSON.stringify({ error: error.message }) };
      return {
        result: JSON.stringify({ deleted: true, id, title: (existing as { title?: string }).title }),
        contentDeleted: { id },
      };
    }
    default:
      return { result: JSON.stringify({ error: `Tool desconocido: ${toolName}` }) };
  }
}

// ─── Tool implementations ────────────────────────────────────────────────────

async function queryReels(
  supabase: SupabaseClient,
  workspaceId: string,
  input: Record<string, unknown>,
  benchmark?: Record<string, number> | null
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? 10, 30);
  const orderBy = (input.order_by as string) ?? 'published_at';
  const orderDir = (input.order_direction as string) ?? 'desc';
  const ascending = orderDir === 'asc';

  let query = supabase
    .from('reels')
    .select(`
      id, caption, published_at, reel_type, has_ads, duration_seconds,
      reel_metrics!inner (views_org, likes_total, comments_total, shares_total, saves_total, follows_generated, avg_watch_time_sec),
      reel_narrative_analysis (hook_text, topic_cluster, has_cta, cta_type, core_promise)
    `)
    .eq('workspace_id', workspaceId)
    .neq('reel_type', 'trial_likely');

  if (input.has_ads !== undefined) {
    query = query.eq('has_ads', input.has_ads as boolean);
  }

  if (input.days_back) {
    const since = new Date();
    since.setDate(since.getDate() - (input.days_back as number));
    query = query.gte('published_at', since.toISOString());
  }

  if (input.min_views) {
    query = query.gte('reel_metrics.views_org', input.min_views as number);
  }

  // Order by metric or date
  const orderCol = ORDER_COLUMN_MAP[orderBy] ?? 'published_at';
  if (orderCol.startsWith('reel_metrics.')) {
    // For related table ordering, we need to use the foreign table syntax
    query = query.order(orderCol.replace('reel_metrics.', ''), { ascending, referencedTable: 'reel_metrics' });
  } else {
    query = query.order(orderCol, { ascending });
  }

  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  const avgViews = benchmark?.avg_views_90d ?? 0;
  const avgSavesPerView = benchmark?.avg_saves_per_view ?? 0;

  const reels = (data ?? []).map((r: Record<string, unknown>) => {
    const metrics = r.reel_metrics as Record<string, unknown> | null;
    const narrative = r.reel_narrative_analysis as Record<string, unknown> | null;
    const views = (metrics?.views_org as number) ?? 0;
    const likes = (metrics?.likes_total as number) ?? 0;
    const comments = (metrics?.comments_total as number) ?? 0;
    const shares = (metrics?.shares_total as number) ?? 0;
    const saves = (metrics?.saves_total as number) ?? 0;

    // Calculated metrics
    const engagement = views > 0 ? (likes + comments + shares + saves) / views : 0;
    const savesPerView = views > 0 ? saves / views : 0;
    const vsBenchmark = avgViews > 0 ? views / avgViews : null;

    return {
      id: r.id,
      caption: ((r.caption as string) ?? '').substring(0, 200),
      published_at: ((r.published_at as string) ?? '').split('T')[0],
      type: r.reel_type,
      has_ads: r.has_ads,
      duration_sec: r.duration_seconds,
      views,
      likes,
      comments,
      shares,
      saves,
      follows: metrics?.follows_generated ?? 0,
      watch_time_sec: metrics?.avg_watch_time_sec ?? 0,
      // Calculated metrics for Claude to analyze directly
      engagement_rate: `${(engagement * 100).toFixed(2)}%`,
      saves_per_view: `${(savesPerView * 100).toFixed(2)}%`,
      saves_per_view_vs_avg: avgSavesPerView > 0 ? `${(savesPerView / avgSavesPerView).toFixed(1)}x` : null,
      vs_benchmark: vsBenchmark !== null ? `${vsBenchmark.toFixed(1)}x promedio` : null,
      hook: narrative?.hook_text ?? null,
      topic: narrative?.topic_cluster ?? null,
      cta: narrative?.has_cta ? narrative?.cta_type : null,
    };
  });

  return JSON.stringify({ count: reels.length, benchmark_views: avgViews > 0 ? Math.round(avgViews) : null, reels });
}

async function getReelDetails(
  supabase: SupabaseClient,
  workspaceId: string,
  reelId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('reels')
    .select(`
      id, caption, permalink, published_at, reel_type, has_ads, duration_seconds,
      reel_metrics (views_org, impressions_org, reach_org, likes_total, comments_total, shares_total, saves_total, follows_generated, avg_watch_time_sec, completion_rate, total_interactions),
      reel_metrics_paid (views_paid, impressions_paid, reach_paid, clicks, spend_cents, video_plays),
      reel_narrative_analysis (hook_text, development_summary, cta_text, closing_text, core_promise, topic_cluster, language_specificity, niche_terms_detected, has_cta, cta_type),
      reel_visual_analysis (orientation, format_type, scene_type, text_on_screen, shot_type, first_frame_has_text, first_frame_face_visible, first_frame_hook_context),
      reel_audio_analysis (words_total, speaking_rate_wpm, filler_density, pauses_estimate),
      reel_transcripts (transcript_clean),
      reel_diagnostics (why_it_worked, why_it_didnt_work, hook_improvements, visual_improvements, cta_improvements, message_improvements)
    `)
    .eq('id', reelId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) return JSON.stringify({ error: error.message });
  if (!data) return JSON.stringify({ error: 'Reel no encontrado' });

  return JSON.stringify(data);
}

async function getBenchmarks(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('reel_benchmarks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) return JSON.stringify({ error: error.message });
  if (!data) return JSON.stringify({ message: 'No hay benchmarks calculados aún' });

  return JSON.stringify(data);
}

async function getAccountInsights(
  supabase: SupabaseClient,
  workspaceId: string,
  days: number
): Promise<string> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('ig_account_insights')
    .select('metric_date, follower_count, followers_total, follows_count, reach, impressions, profile_views, website_clicks, email_contacts, media_count')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', startStr)
    .order('metric_date', { ascending: false });

  if (error) return JSON.stringify({ error: error.message });
  if (!data || data.length === 0) return JSON.stringify({ message: 'No hay datos de cuenta de Instagram aún.' });

  // Latest snapshot
  const latest = data[0];
  const totalFollowers = latest.followers_total || 0;

  // Follower growth = sum of daily deltas
  const followerGrowth = data.reduce((sum, d) => sum + (d.follower_count || 0), 0);

  // Averages
  const avgReach = Math.round(data.reduce((s, d) => s + (d.reach || 0), 0) / data.length);
  const avgImpressions = Math.round(data.reduce((s, d) => s + (d.impressions || 0), 0) / data.length);
  const totalReach = data.reduce((s, d) => s + (d.reach || 0), 0);
  const totalImpressions = data.reduce((s, d) => s + (d.impressions || 0), 0);

  return JSON.stringify({
    period_days: days,
    data_points: data.length,
    current_followers: totalFollowers,
    follower_growth: followerGrowth,
    total_reach: totalReach,
    avg_daily_reach: avgReach,
    total_impressions: totalImpressions,
    avg_daily_impressions: avgImpressions,
    latest_profile_views: latest.profile_views || 0,
    latest_website_clicks: latest.website_clicks || 0,
    media_count: latest.media_count || 0,
    daily_breakdown: data.slice(0, 14).map(d => ({
      date: d.metric_date,
      followers_total: d.followers_total || 0,
      follower_delta: d.follower_count || 0,
      reach: d.reach || 0,
      impressions: d.impressions || 0,
    })),
  });
}

async function getContentCalendar(
  supabase: SupabaseClient,
  workspaceId: string,
  days: number
): Promise<string> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString();

  const { data: reels, error } = await supabase
    .from('reels')
    .select('published_at')
    .eq('workspace_id', workspaceId)
    .neq('reel_type', 'trial_likely')
    .gte('published_at', startStr)
    .order('published_at', { ascending: false });

  if (error) return JSON.stringify({ error: error.message });
  if (!reels || reels.length === 0) {
    return JSON.stringify({ message: `No se publicaron reels en los últimos ${days} días.` });
  }

  const totalReels = reels.length;
  const weeks = days / 7;
  const postsPerWeek = +(totalReels / weeks).toFixed(1);

  // Day of week distribution (0=Sunday, 6=Saturday)
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};
  const publishDates: string[] = [];

  for (const r of reels) {
    const d = new Date(r.published_at);
    const dayName = dayNames[d.getDay()];
    dayCount[dayName] = (dayCount[dayName] || 0) + 1;
    hourCount[d.getHours()] = (hourCount[d.getHours()] || 0) + 1;
    publishDates.push(d.toISOString().split('T')[0]);
  }

  // Find gaps (days without publishing)
  const uniqueDates = [...new Set(publishDates)].sort();
  const gaps: { from: string; to: string; days: number }[] = [];
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      gaps.push({ from: uniqueDates[i - 1], to: uniqueDates[i], days: diffDays });
    }
  }

  // Current streak — days since last publish
  const lastPublish = new Date(reels[0].published_at);
  const daysSinceLastPost = Math.floor((Date.now() - lastPublish.getTime()) / (1000 * 60 * 60 * 24));

  // Top 3 publishing hours
  const topHours = Object.entries(hourCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h, count]) => ({ hour: `${h}:00`, posts: count }));

  // Top publishing days
  const topDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .map(([day, count]) => ({ day, posts: count }));

  return JSON.stringify({
    period_days: days,
    total_posts: totalReels,
    posts_per_week: postsPerWeek,
    days_since_last_post: daysSinceLastPost,
    last_post_date: reels[0].published_at.split('T')[0],
    posts_by_day_of_week: topDays,
    top_publishing_hours: topHours,
    longest_gaps: gaps.sort((a, b) => b.days - a.days).slice(0, 5),
    days_with_posts: uniqueDates.length,
    days_without_posts: days - uniqueDates.length,
  });
}

async function getAudienceDemographics(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('ig_account_demographics')
    .select('audience_gender_age, audience_city, audience_country, audience_locale, snapshot_date')
    .eq('workspace_id', workspaceId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return JSON.stringify({ error: error.message });
  if (!data) return JSON.stringify({ message: 'No hay datos demográficos disponibles.' });

  const genderAge = (data.audience_gender_age ?? {}) as Record<string, number>;
  const cities = (data.audience_city ?? {}) as Record<string, number>;
  const countries = (data.audience_country ?? {}) as Record<string, number>;
  const locales = (data.audience_locale ?? {}) as Record<string, number>;

  // Parse gender
  let male = 0, female = 0;
  const ageRanges: Record<string, number> = {};
  for (const [key, val] of Object.entries(genderAge)) {
    if (key.startsWith('gender:M')) male += val;
    else if (key.startsWith('gender:F')) female += val;
    if (key.startsWith('age:')) {
      const range = key.replace('age:', '');
      ageRanges[range] = (ageRanges[range] || 0) + val;
    }
  }
  const totalGender = male + female || 1;

  // Top cities/countries/locales
  const sortByValue = (obj: Record<string, number>, limit: number) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));

  return JSON.stringify({
    snapshot_date: data.snapshot_date,
    gender: {
      male_pct: +((male / totalGender) * 100).toFixed(1),
      female_pct: +((female / totalGender) * 100).toFixed(1),
      male_count: male,
      female_count: female,
    },
    age_ranges: Object.entries(ageRanges)
      .sort((a, b) => b[1] - a[1])
      .map(([range, count]) => ({ range, count, pct: +((count / totalGender) * 100).toFixed(1) })),
    top_cities: sortByValue(cities, 10),
    top_countries: sortByValue(countries, 10),
    top_languages: sortByValue(locales, 5),
  });
}

async function comparePeriods(
  supabase: SupabaseClient,
  workspaceId: string,
  periodDays: number
): Promise<string> {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - periodDays);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - periodDays);

  const prevStartStr = previousStart.toISOString().split('T')[0];
  const currStartStr = currentStart.toISOString().split('T')[0];
  const nowStr = now.toISOString().split('T')[0];

  // Account insights for both periods
  const { data: insights } = await supabase
    .from('ig_account_insights')
    .select('metric_date, reach, impressions, follower_count, followers_total, profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', prevStartStr)
    .lt('metric_date', nowStr)
    .order('metric_date', { ascending: true });

  // Reels count for both periods
  const { count: currentReelsCount } = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .neq('reel_type', 'trial_likely')
    .gte('published_at', currentStart.toISOString());

  const { count: prevReelsCount } = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .neq('reel_type', 'trial_likely')
    .gte('published_at', previousStart.toISOString())
    .lt('published_at', currentStart.toISOString());

  if (!insights || insights.length === 0) {
    return JSON.stringify({ message: 'No hay suficientes datos para comparar períodos.' });
  }

  const currentInsights = insights.filter(i => i.metric_date >= currStartStr);
  const previousInsights = insights.filter(i => i.metric_date >= prevStartStr && i.metric_date < currStartStr);

  const sumField = (arr: typeof insights, field: string) =>
    arr.reduce((s, d) => s + ((d as Record<string, number>)[field] || 0), 0);

  const buildPeriodSummary = (arr: typeof insights, reelsCount: number | null) => ({
    days_with_data: arr.length,
    total_reach: sumField(arr, 'reach'),
    total_impressions: sumField(arr, 'impressions'),
    follower_growth: sumField(arr, 'follower_count'),
    total_engagement: sumField(arr, 'total_interactions'),
    total_likes: sumField(arr, 'likes'),
    total_comments: sumField(arr, 'comments'),
    total_shares: sumField(arr, 'shares'),
    total_saves: sumField(arr, 'saves'),
    total_profile_views: sumField(arr, 'profile_views'),
    reels_published: reelsCount ?? 0,
  });

  const current = buildPeriodSummary(currentInsights, currentReelsCount);
  const previous = buildPeriodSummary(previousInsights, prevReelsCount);

  // Calculate deltas
  const pctChange = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : +((((curr - prev) / prev) * 100).toFixed(1));

  const changes = {
    reach: pctChange(current.total_reach, previous.total_reach),
    impressions: pctChange(current.total_impressions, previous.total_impressions),
    follower_growth: pctChange(current.follower_growth, previous.follower_growth),
    engagement: pctChange(current.total_engagement, previous.total_engagement),
    likes: pctChange(current.total_likes, previous.total_likes),
    comments: pctChange(current.total_comments, previous.total_comments),
    shares: pctChange(current.total_shares, previous.total_shares),
    saves: pctChange(current.total_saves, previous.total_saves),
    profile_views: pctChange(current.total_profile_views, previous.total_profile_views),
    reels_published: pctChange(current.reels_published, previous.reels_published),
  };

  // Latest followers total
  const latestWithFollowers = [...currentInsights].reverse().find(i => i.followers_total > 0);

  return JSON.stringify({
    period_days: periodDays,
    current_period: { start: currStartStr, end: nowStr, ...current },
    previous_period: { start: prevStartStr, end: currStartStr, ...previous },
    pct_changes: changes,
    current_followers_total: latestWithFollowers?.followers_total ?? null,
  });
}

async function getGoals(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('workspace_goals')
    .select('metric, target_value, period_start, period_end')
    .eq('workspace_id', workspaceId)
    .order('period_start', { ascending: false });

  if (error) return JSON.stringify({ error: error.message });
  if (!data || data.length === 0) return JSON.stringify({ message: 'No hay metas definidas' });

  return JSON.stringify(data);
}

async function searchReelsByTopic(
  supabase: SupabaseClient,
  workspaceId: string,
  query: string,
  limit: number
): Promise<string> {
  // Search in captions
  const { data: captionResults } = await supabase
    .from('reels')
    .select(`
      id, caption, published_at,
      reel_metrics (views_org, likes_total, saves_total),
      reel_narrative_analysis (hook_text, topic_cluster)
    `)
    .eq('workspace_id', workspaceId)
    .neq('reel_type', 'trial_likely')
    .ilike('caption', `%${query}%`)
    .order('published_at', { ascending: false })
    .limit(limit);

  // Search in hooks
  const { data: hookResults } = await supabase
    .from('reel_narrative_analysis')
    .select(`
      hook_text, topic_cluster, core_promise, reel_id,
      reels!inner (id, caption, published_at, reel_type, reel_metrics (views_org, likes_total, saves_total))
    `)
    .eq('workspace_id', workspaceId)
    .neq('reels.reel_type', 'trial_likely')
    .or(`hook_text.ilike.%${query}%,topic_cluster.ilike.%${query}%,core_promise.ilike.%${query}%`)
    .limit(limit);

  // Merge and deduplicate
  const seen = new Set<string>();
  const results: Record<string, unknown>[] = [];

  for (const r of (captionResults ?? [])) {
    const id = r.id as string;
    if (!seen.has(id)) {
      seen.add(id);
      const metrics = r.reel_metrics as unknown as Record<string, unknown> | null;
      const narrative = r.reel_narrative_analysis as unknown as Record<string, unknown> | null;
      results.push({
        id,
        caption: ((r.caption as string) ?? '').substring(0, 150),
        published_at: ((r.published_at as string) ?? '').split('T')[0],
        views: metrics?.views_org ?? 0,
        hook: narrative?.hook_text ?? null,
        topic: narrative?.topic_cluster ?? null,
        match: 'caption',
      });
    }
  }

  for (const r of (hookResults ?? [])) {
    const reel = r.reels as unknown as Record<string, unknown> | null;
    const id = (reel?.id ?? r.reel_id) as string;
    if (!seen.has(id)) {
      seen.add(id);
      results.push({
        id,
        hook: r.hook_text,
        topic: r.topic_cluster,
        promise: r.core_promise,
        match: 'narrative',
      });
    }
  }

  return JSON.stringify({ query, count: results.length, results });
}

async function getTopHooks(
  supabase: SupabaseClient,
  workspaceId: string,
  limit: number,
  metric: string
): Promise<string> {
  const orderCol = metric === 'saves' ? 'saves_total'
    : metric === 'shares' ? 'shares_total'
    : metric === 'engagement' ? 'total_interactions'
    : 'views_org';

  const { data, error } = await supabase
    .from('reel_narrative_analysis')
    .select(`
      hook_text, topic_cluster, core_promise,
      reels!inner (
        id, caption, published_at, duration_seconds, reel_type,
        reel_metrics!inner (views_org, likes_total, saves_total, shares_total, total_interactions)
      )
    `)
    .eq('workspace_id', workspaceId)
    .neq('reels.reel_type', 'trial_likely')
    .not('hook_text', 'is', null)
    .order(orderCol, { ascending: false, referencedTable: 'reels.reel_metrics' })
    .limit(limit);

  if (error) return JSON.stringify({ error: error.message });

  const hooks = (data ?? []).map((r: Record<string, unknown>) => {
    const reel = r.reels as unknown as Record<string, unknown> | null;
    const metrics = reel?.reel_metrics as unknown as Record<string, unknown> | null;
    return {
      hook: r.hook_text,
      topic: r.topic_cluster,
      promise: r.core_promise,
      reel_id: reel?.id,
      published_at: ((reel?.published_at as string) ?? '').split('T')[0],
      views: metrics?.views_org ?? 0,
      saves: metrics?.saves_total ?? 0,
      shares: metrics?.shares_total ?? 0,
    };
  });

  return JSON.stringify({ metric, count: hooks.length, hooks });
}

async function getTopicClusters(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('reel_narrative_analysis')
    .select(`
      topic_cluster,
      reels!inner (
        id, reel_type,
        reel_metrics (views_org, likes_total, saves_total, shares_total)
      )
    `)
    .eq('workspace_id', workspaceId)
    .neq('reels.reel_type', 'trial_likely')
    .not('topic_cluster', 'is', null);

  if (error) return JSON.stringify({ error: error.message });

  // Aggregate by cluster
  const clusters: Record<string, { count: number; total_views: number; total_saves: number; total_shares: number }> = {};

  for (const r of (data ?? [])) {
    const topic = r.topic_cluster as string;
    if (!topic) continue;
    const reel = r.reels as unknown as Record<string, unknown> | null;
    const metrics = reel?.reel_metrics as unknown as Record<string, unknown> | null;

    if (!clusters[topic]) {
      clusters[topic] = { count: 0, total_views: 0, total_saves: 0, total_shares: 0 };
    }
    clusters[topic].count++;
    clusters[topic].total_views += (metrics?.views_org as number) ?? 0;
    clusters[topic].total_saves += (metrics?.saves_total as number) ?? 0;
    clusters[topic].total_shares += (metrics?.shares_total as number) ?? 0;
  }

  const sorted = Object.entries(clusters)
    .map(([topic, stats]) => ({
      topic,
      reels_count: stats.count,
      avg_views: Math.round(stats.total_views / stats.count),
      avg_saves: Math.round(stats.total_saves / stats.count),
      avg_shares: Math.round(stats.total_shares / stats.count),
    }))
    .sort((a, b) => b.avg_views - a.avg_views);

  return JSON.stringify({ count: sorted.length, clusters: sorted });
}

async function getCompetitorAnalysis(
  supabase: SupabaseClient,
  workspaceId: string,
  input: Record<string, unknown>
): Promise<string> {
  const includeReels = (input.include_reels as boolean) ?? true;
  const topN = Math.min((input.top_n as number) ?? 5, 15);
  const competitorName = input.competitor_name as string | undefined;

  // Get competitors
  let competitorQuery = supabase
    .from('workspace_competitors')
    .select('id, name, ig_url, why_better, scraped_data, last_scraped_at')
    .eq('workspace_id', workspaceId);

  if (competitorName) {
    competitorQuery = competitorQuery.ilike('name', `%${competitorName}%`);
  }

  const { data: competitors, error } = await competitorQuery;
  if (error) return JSON.stringify({ error: error.message });
  if (!competitors || competitors.length === 0) {
    return JSON.stringify({ message: 'No hay competidores configurados en este workspace. El usuario debe agregarlos desde Customer Voice o el onboarding.' });
  }

  const result: Record<string, unknown>[] = [];

  for (const comp of competitors) {
    const profile = comp.scraped_data as Record<string, unknown> | null;
    const entry: Record<string, unknown> = {
      name: comp.name,
      ig_url: comp.ig_url,
      what_user_likes: comp.why_better,
      last_scraped: comp.last_scraped_at,
      profile: profile && Object.keys(profile).length > 0 ? {
        followers: profile.ig_follower_count ?? null,
        following: profile.ig_following_count ?? null,
        posts: profile.ig_post_count ?? null,
        bio: profile.ig_bio ?? null,
        is_verified: profile.ig_is_verified ?? false,
        category: profile.ig_business_category ?? null,
      } : null,
    };

    if (includeReels) {
      const { data: reels } = await supabase
        .from('competitor_reels')
        .select(`
          id, caption, views_count, likes_count, comments_count, shares_count,
          duration_seconds, published_at, transcript, hashtags,
          competitor_reel_analysis (
            hook_text, hook_type, content_type, topic_cluster,
            style_notes, strengths, weaknesses, ai_summary, cta_type
          )
        `)
        .eq('competitor_id', comp.id)
        .order('views_count', { ascending: false, nullsFirst: false })
        .limit(topN);

      entry.top_reels = (reels ?? []).map((r: Record<string, unknown>) => {
        const analysis = r.competitor_reel_analysis as Record<string, unknown> | null;
        return {
          caption: ((r.caption as string) ?? '').substring(0, 200),
          views: r.views_count,
          likes: r.likes_count,
          comments: r.comments_count,
          shares: r.shares_count,
          duration_sec: r.duration_seconds,
          published_at: ((r.published_at as string) ?? '').split('T')[0],
          has_transcript: Boolean(r.transcript),
          analysis: analysis ? {
            hook: analysis.hook_text,
            hook_type: analysis.hook_type,
            content_type: analysis.content_type,
            topic: analysis.topic_cluster,
            style: analysis.style_notes,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            summary: analysis.ai_summary,
            cta_type: analysis.cta_type,
          } : null,
        };
      });
      entry.reels_count = reels?.length ?? 0;
    }

    result.push(entry);
  }

  return JSON.stringify({ competitors: result, count: result.length });
}

// ─── ADN context for system prompt ───────────────────────────────────────────

export async function loadAdnContext(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const adn = await getAdnData(supabase, workspaceId);
  const sections: string[] = [];

  if (adn.profile) {
    sections.push(`## Perfil del Negocio
- Descripción: ${adn.profile.business_description ?? 'No definido'}
- Persona de marca: ${adn.profile.brand_persona ?? 'No definido'}
- Avatar del cliente ideal: ${adn.profile.avatar_description ?? 'No definido'}
- Audiencia objetivo: ${adn.profile.target_audience ?? 'No definido'}
- Oferta principal: ${adn.profile.main_offer ?? 'No definido'}`);
  }

  if (adn.brand) {
    sections.push(`## Marca
- Por qué te eligen: ${adn.brand.why_clients_choose ?? 'No definido'}
- Lenguaje del nicho: ${adn.brand.niche_language ?? 'No definido'}
- Herramientas del nicho: ${adn.brand.niche_tools ?? 'No definido'}
- Palabras filtro: ${adn.brand.filtering_words ?? 'No definido'}
- Mecanismos nuevos: ${adn.brand.new_mechanisms ?? 'No definido'}`);
  }

  if (adn.market) {
    sections.push(`## Mercado
- Estado de la industria: ${adn.market.industry_state ?? 'No definido'}
- Exposición de la audiencia: ${adn.market.audience_exposure ?? 'No definido'}
- Creencias del mercado: ${adn.market.market_beliefs ?? 'No definido'}
- Temas quemados: ${adn.market.burned_topics ?? 'No definido'}
- Tendencias actuales: ${adn.market.current_trends ?? 'No definido'}
- Competitividad: ${adn.market.competitiveness ?? 'No definido'}
- Diferenciador: ${adn.market.differentiator ?? 'No definido'}`);
  }

  if (adn.competitors.length > 0) {
    const compList = adn.competitors.map(c =>
      `- ${c.name ?? 'Sin nombre'}${c.ig_url ? ` (${c.ig_url})` : ''}: ${c.why_better ? c.why_better.replace(/\[(MARCA|CONTENIDO)]\s*/g, (_, tag: string) => tag === 'MARCA' ? 'Le gusta de su marca: ' : 'Le gusta de su contenido: ') : 'sin info'}`
    ).join('\n');
    sections.push(`## Competidores\n${compList}`);
  }

  if (adn.strategies.length > 0) {
    for (const s of adn.strategies) {
      sections.push(`## Estrategia — ${s.platform ?? 'Sin plataforma'}
- Qué probaste: ${s.what_tested ?? 'No definido'}
- Resultados: ${s.test_results ?? 'No definido'}
- Conclusiones: ${s.conclusions ?? 'No definido'}
- Estrategia actual: ${s.current_strategy ?? 'No definido'}
- Formatos y cantidad: ${s.formats_and_quantity ?? 'No definido'}
- Por qué va a funcionar: ${s.why_it_will_work ?? 'No definido'}`);
    }
  }

  if (adn.references.length > 0) {
    const refList = adn.references.map(r =>
      `- ${r.brand_name ?? 'Sin nombre'}${r.brand_url ? ` (${r.brand_url})` : ''}: ${r.what_they_like ?? 'sin info'}`
    ).join('\n');
    sections.push(`## Marcas de Referencia\n${refList}`);
  }

  return sections.join('\n\n') || '_No hay datos de ADN cargados aún._';
}

// ─── Benchmarks context for system prompt ────────────────────────────────────

async function loadBenchmarksContext(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data } = await supabase
    .from('reel_benchmarks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!data) return '_No hay benchmarks calculados aún._';

  const b = data as Record<string, unknown>;
  const fmt = (v: unknown) => typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v as number))) : 'N/A';
  const pct = (v: unknown) => typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : 'N/A';

  return `## Benchmarks del workspace (90 días, ${b.reels_in_window ?? '?'} reels)

**Promedios:**
- Views: ${fmt(b.avg_views_90d)} | Likes: ${fmt(b.avg_likes_90d)} | Comments: ${fmt(b.avg_comments_90d)}
- Shares: ${fmt(b.avg_shares_90d)} | Saves: ${fmt(b.avg_saves_90d)} | Follows: ${fmt(b.avg_follows_90d)}
- Watch time: ${typeof b.avg_watch_time_90d === 'number' ? `${(b.avg_watch_time_90d as number).toFixed(1)}s` : 'N/A'}
- Duración promedio: ${typeof b.avg_duration_seconds === 'number' ? `${(b.avg_duration_seconds as number).toFixed(0)}s` : 'N/A'}

**Ratios por view:**
- Likes/view: ${pct(b.avg_likes_per_view)} | Comments/view: ${pct(b.avg_comments_per_view)}
- Shares/view: ${pct(b.avg_shares_per_view)} | Saves/view: ${pct(b.avg_saves_per_view)}
- Follows/view: ${pct(b.avg_follows_per_view)}

**Engagement:** ${pct(b.avg_engagement_rate)} | **Retención:** ${pct(b.avg_retention_rate)}`;
}

// ─── Top topics context for system prompt ────────────────────────────────────

async function loadTopTopicsContext(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data } = await supabase
    .from('reel_narrative_analysis')
    .select(`
      topic_cluster,
      reels!inner (
        id, reel_type,
        reel_metrics (views_org, saves_total, shares_total)
      )
    `)
    .eq('workspace_id', workspaceId)
    .neq('reels.reel_type', 'trial_likely')
    .not('topic_cluster', 'is', null);

  if (!data || data.length === 0) return '_No hay datos de temas aún._';

  // Aggregate
  const clusters: Record<string, { count: number; totalViews: number; totalSaves: number; totalShares: number }> = {};
  for (const r of data) {
    const topic = r.topic_cluster as string;
    if (!topic) continue;
    const reel = r.reels as unknown as Record<string, unknown> | null;
    const metrics = reel?.reel_metrics as unknown as Record<string, unknown> | null;
    if (!clusters[topic]) clusters[topic] = { count: 0, totalViews: 0, totalSaves: 0, totalShares: 0 };
    clusters[topic].count++;
    clusters[topic].totalViews += (metrics?.views_org as number) ?? 0;
    clusters[topic].totalSaves += (metrics?.saves_total as number) ?? 0;
    clusters[topic].totalShares += (metrics?.shares_total as number) ?? 0;
  }

  const sorted = Object.entries(clusters)
    .map(([topic, s]) => ({
      topic,
      count: s.count,
      avgViews: Math.round(s.totalViews / s.count),
      avgSaves: Math.round(s.totalSaves / s.count),
      avgShares: Math.round(s.totalShares / s.count),
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 10);

  const lines = sorted.map((t, i) =>
    `${i + 1}. **${t.topic}** — ${t.count} reels, ~${t.avgViews >= 1000 ? `${(t.avgViews / 1000).toFixed(1)}K` : t.avgViews} views prom, ${t.avgSaves} saves, ${t.avgShares} shares`
  );

  return `## Top 10 temas por rendimiento\n${lines.join('\n')}`;
}

// ─── Pipeline snapshot for system prompt (Mesa de Trabajo context) ───────────

const STATUS_LABELS_ES: Record<string, string> = {
  idea: 'Idea',
  ready_to_record: 'Listo para grabar',
  raw_footage: 'Videos crudos',
  editing: 'Editando',
  ready_to_publish: 'Listo para publicar',
  published: 'Publicado',
};

/**
 * Loads the current Mesa de Trabajo pipeline items, grouped by status,
 * formatted for inclusion in the system prompt. Used when the chat is
 * opened from the Mesa de Trabajo view so Moka knows the pipeline state
 * without needing to call list_pipeline_items first.
 */
export async function loadPipelineSnapshot(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('content_plan')
    .select('id, title, content_type, status, planned_date, script')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error || !data || data.length === 0) {
    return '_Pipeline vacío — el usuario aún no tiene contenido cargado en Mesa de Trabajo._';
  }

  const byStatus: Record<string, Array<Record<string, unknown>>> = {};
  for (const item of data) {
    const status = (item.status as string) ?? 'idea';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(item as Record<string, unknown>);
  }

  const order = ['idea', 'ready_to_record', 'raw_footage', 'editing', 'ready_to_publish', 'published'];
  const sections: string[] = [];

  for (const status of order) {
    const items = byStatus[status];
    if (!items || items.length === 0) continue;
    const label = STATUS_LABELS_ES[status] ?? status;
    const lines = items.map((item) => {
      const type = item.content_type ?? 'reel';
      const date = item.planned_date ? ` · ${item.planned_date}` : '';
      const hasScript = item.script ? ' · con guión' : '';
      return `  - [${item.id}] (${type}${date}${hasScript}) ${item.title}`;
    });
    sections.push(`**${label}** (${items.length}):\n${lines.join('\n')}`);
  }

  return `## Estado actual de la Mesa de Trabajo
Total de items: ${data.length}

${sections.join('\n\n')}

(Tenés los IDs entre corchetes. Cuando el usuario te pida modificar/mover/borrar un item, usá el ID directamente sin llamar a list_pipeline_items.)`;
}
