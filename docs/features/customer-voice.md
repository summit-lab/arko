# Feature: Customer Voice Intelligence

## Descripción
Módulo que absorbe data cualitativa de prospectos y clientes. Dos fuentes principales: formularios (Typeform) y transcripciones de llamadas de venta.

## Funcionalidades

### 1. Análisis de Formularios
- Conectado a Typeform (onboarding + satisfacción de cliente).
- Los datos van a Google Sheets → la app los lee desde ahí.
- Muestra respuestas clave: "¿Qué te hizo comprarme?", "¿Por qué yo y no otra persona?", etc.
- Agrupa y detecta patrones en las respuestas.

### 2. Transcripción de Llamadas de Venta
- Transcribe grabaciones de llamadas de venta.
- Extrae frases clave, dolores, objeciones, razones de compra.
- Muestra las transcripciones organizadas con highlights.

### 3. Insights Agregados
- Patrones: qué dicen los prospectos sobre por qué compran.
- Dolores más mencionados.
- Objeciones frecuentes.
- Frases textuales que sirven para copy de marketing.

## Fuente de Datos
- Google Sheets (datos de Typeform).
- Grabaciones de llamadas de venta (audio → Whisper transcription).
- Análisis cualitativo vía GPT-4.

## Ruta
`/customer-voice`
