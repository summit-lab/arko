# Feature: Customer Voice Intelligence

## Descripción
Módulo central que combina el ADN de marca del usuario con el análisis de competidores. Dos tabs principales: ADN de Marca y Competencia.

## Ruta
`/customer-voice`

## Arquitectura — Tabs

### Tab 1: ADN de Marca
Muestra toda la data cualitativa del workspace:
- **Identidad**: negocio, oferta, personalidad de marca, avatar, audiencia
- **Diferenciadores**: por qué te eligen, diferenciador, mecanismos nuevos
- **Mercado**: estado de la industria, creencias, temas quemados, tendencias
- **ADN del Nicho**: lenguaje, herramientas, palabras filtro
- **Competidores** (lista compacta): nombre, URL, por qué sos mejor
- **Estrategias**: por plataforma (Instagram, YouTube)
- **Marcas de Referencia**: inspiración
- **Metas Mensuales**: goals editables

Fuente de datos: tablas `workspace_*` del onboarding ADN + `workspace_goals`.

### Tab 2: Competencia
Análisis profundo de competidores con scraping e IA.

#### Flujo
1. Usuario agrega competidores durante onboarding (nombre + IG URL)
2. Desde el tab Competencia, puede hacer **Scrapear** por competidor
3. Apify scrapea perfil (followers, bio, posts) + últimos 15 reels públicos
4. Datos se guardan en `workspace_competitors.scraped_data` (perfil) y `competitor_reels` (reels)
5. Botón **Analizar con IA** corre análisis de cada reel: hook, tipo, estructura, CTA, fortalezas/debilidades
6. Resultados en `competitor_reel_analysis`
7. Arko AI tiene acceso a todo via tool `get_competitor_analysis`

#### UI por competidor
- Header: nombre, IG URL, badge verificado
- Stats: followers, posts, reels scrapeados, último scraping
- Bio del competidor
- Lista de top reels expandibles con:
  - Métricas (views, likes, comments, shares)
  - Badge de tipo de hook (coloreado)
  - Análisis expandible: hook, resumen IA, fortalezas, debilidades, tags
- "Por qué vos sos mejor" (del ADN)

## Tablas de DB

### competitor_reels
Reels scrapeados de competidores via Apify.
- FK a `workspace_competitors(id)` y `workspaces(id)`
- Unique index en `(competitor_id, short_code)` para deduplicación
- Campos: caption, métricas, transcript, hashtags, música, raw_data JSONB

### competitor_reel_analysis
Análisis IA de cada reel de competidor.
- 1:1 con `competitor_reels` (UNIQUE on competitor_reel_id)
- Campos: hook_text, hook_type, narrative_structure, content_type, cta_text/type, topic_cluster, style_notes, strengths, weaknesses, ai_summary
- Tracking: model_used, tokens_used

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/competitors/[id]/scrape` | Scrapear perfil + reels via Apify |
| POST | `/api/v1/competitors/[id]/analyze` | Analizar reels sin análisis con IA |

## Servicios

| Archivo | Responsabilidad |
|---------|----------------|
| `src/services/competitor-scraper.service.ts` | Apify scraping de perfil + reels |
| `src/services/competitor-analysis.service.ts` | Análisis IA de reels (hooks, estilo, CTA) |

## Integración con Arko AI

Tool `get_competitor_analysis` en `arko-ai-context.ts`:
- Devuelve perfil + top reels + análisis de cada competidor
- Filtrable por nombre de competidor
- Arko puede comparar "tus hooks vs los de tu competencia"

## Componentes

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/app/(dashboard)/customer-voice/page.tsx` | Server | Page principal con data fetching |
| `src/app/(dashboard)/customer-voice/CustomerVoiceTabs.tsx` | Client | Tab switcher (ADN / Competencia) |
| `src/app/(dashboard)/customer-voice/CompetitorPanel.tsx` | Client | Panel de competidores con scrape/analyze |
