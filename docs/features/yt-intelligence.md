# Feature: YouTube Intelligence

## Descripción
Módulo que conecta con el canal de YouTube del usuario y analiza los videos. Mismo concepto que IG Intelligence pero para YouTube. Menor volumen (1 video cada 7-10 días).

## Funcionalidades

### 1. Lista de Videos
- Muestra los últimos videos publicados.
- Cada video: miniatura, título, fecha, métricas (views, likes, comments, watch time).
- Clic para expandir vista detallada.

### 2. Vista Detallada de un Video
- **Miniatura grande / Preview.**
- **Métricas clave:** Views, likes, comments, watch time promedio, CTR del thumbnail.
- **Curva de retención:** Gráfica de retención de audiencia a lo largo del video.
- **Puntos de mejora:** Insights generados por IA sobre dónde se pierde audiencia.
- **Guión transcrito:** Transcripción formateada línea por línea.
- **Análisis de contenido:** Temas tratados, ganchos usados, estructura del video.

### 3. Análisis Comparativo
- Comparar retención entre videos.
- Detectar qué temas/formatos funcionan mejor.
- Contrastar contenido vs métricas.

## Fuente de Datos
- YouTube Data API v3.
- Transcripción vía OpenAI Whisper.
- Análisis cualitativo vía GPT-4.

## Ruta
`/youtube`
