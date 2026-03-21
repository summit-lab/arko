# Feature: AI Brain / Agents

## Descripción
Interfaz de chat con agentes de IA especializados. Cada agente tiene acceso exclusivo a su dominio de datos. El usuario puede etiquetar (@mention) al agente que necesita y ese agente responde basándose en toda la data que ha procesado de su módulo.

## Agentes Disponibles

### @InstagramIntelligence
- Acceso a: transcripciones de Reels, métricas de Reels, curvas de retención, análisis de ganchos.
- Casos de uso: "Dame ideas de tópicos para Reels basado en lo que mejor me funcionó en los últimos 30 días", "¿Cuál fue mi mejor hook rate?", "¿Qué temas generaron más guardados?".

### @YouTubeIntelligence
- Acceso a: transcripciones de videos, métricas de YouTube, retención, CTR de thumbnails.
- Casos de uso: "¿Qué estructura de video me genera más watch time?", "¿En qué minuto pierdo más audiencia?".

### @AdsIntelligence
- Acceso a: data de campañas, métricas de ads, creativos, segmentación geográfica.
- Casos de uso: "¿Cuál es mi mejor CPA este mes?", "¿Qué creativos funcionan mejor en España vs Argentina?".

### @CustomerVoice
- Acceso a: respuestas de formularios, transcripciones de llamadas de venta, dolores y objeciones.
- Casos de uso: "¿Cuáles son los 3 dolores más mencionados por los prospectos?", "Dame frases textuales de clientes para usar en copy".

## Arquitectura
- Cada agente es un prompt especializado con acceso a datos filtrados de su módulo (RAG).
- Los agentes están separados para evitar mezcla de datos y mejorar precisión.
- El usuario puede etiquetar a uno o varios agentes en una conversación.

## Ruta
`/agents`
