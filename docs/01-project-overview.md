# Arko — AI Marketing Director

## Visión
Arko es un SaaS analítico de alto valor que actúa como "Director de Marketing impulsado por IA" para creadores de contenido y marcas personales de alta facturación (>$30K USD/mes). Cruza métricas cuantitativas (views, retención, engagement) con datos cualitativos (transcripciones de videos, llamadas de ventas, feedback de clientes) usando Inteligencia Artificial para tomar decisiones de marketing hiper-optimizadas.

## Objetivos
- Unificar datos de redes sociales (Instagram, YouTube), Ads (Meta Ads) y ventas (formularios, llamadas) en una sola plataforma
- Analizar contenido con IA: transcribir videos, detectar patrones de éxito/fallo de retención, cruzar con métricas de ventas reales
- Proveer una interfaz de Agentes de IA especializados (@InstagramIntelligence, @YouTubeIntelligence, @AdsIntelligence, @CustomerVoice) que generan insights y guiones accionables basados en datos reales
- Eliminar las "adivinanzas" del marketing de contenido mediante análisis data-driven

## Stack Técnico
| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React | 19.2.3 |
| Framework | Next.js (App Router) | 16.1.7 |
| Backend | Next.js API Routes + Supabase Edge Functions | - |
| Base de datos | Supabase (PostgreSQL) | - |
| Estilos | TailwindCSS | 4.x |
| Componentes UI | shadcn/ui | latest |
| Auth | Supabase Auth | - |
| IA/LLM | OpenAI API (GPT-4) | - |
| Tareas Async | Supabase Edge Functions + pg_cron | - |
| Transcripción | OpenAI Whisper API | - |
| Deploy | Vercel | - |
| Icons | Lucide React | latest |

## Módulos del Sistema

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | Dashboard Global | Centro de comando visual: progreso de objetivos, tráfico orgánico vs pago, views por país |
| 2 | Instagram Intelligence | Descarga Reels, transcribe guiones, analiza contenido visual, cruza con métricas de interacción |
| 3 | YouTube Intelligence | Réplica del modelo Instagram adaptado a YouTube |
| 4 | Ads Intelligence | Extracción automática de Meta Ads + análisis de contenido por segmento/país |
| 5 | Customer Voice | Unifica datos de satisfacción (Typeform) + transcripciones de llamadas de ventas |
| 6 | Agentes de IA | Chat interactivo con agentes especializados (@InstagramIntelligence, @YouTubeIntelligence, etc.) |

## Estado del Proyecto
| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Setup + Auth + Dashboard base | [ ] Pendiente |
| 2 | Instagram Intelligence (core) | [ ] Pendiente |
| 3 | YouTube Intelligence | [ ] Pendiente |
| 4 | Ads Intelligence | [ ] Pendiente |
| 5 | Customer Voice | [ ] Pendiente |
| 6 | Agentes de IA (chat interactivo) | [ ] Pendiente |
| 7 | Polish + Deploy | [ ] Pendiente |

## Principio Fundamental
> La IA no adivina: analiza datos reales de contenido, métricas y clientes para generar decisiones de marketing comprobables.

## Desafíos Técnicos Clave
- **Bloqueo de Meta:** La API de Instagram no entrega curva de retención segundo a segundo → flujo alternativo con OCR de capturas de pantalla
- **Procesamiento Pesado:** Descarga y transcripción de videos requiere arquitectura de tareas asíncronas en segundo plano
- **Precisión RAG:** Sistema que consulta primero la base de datos matemática con exactitud, luego analiza textos/transcripciones
- **Migraciones:** Cambios en DB solo vía migraciones automatizadas, nunca tocar la base de datos de forma manual
