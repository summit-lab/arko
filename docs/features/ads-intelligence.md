# Feature: Ads Intelligence

## Descripción
Módulo conectado a Meta Ads Manager. Lee data cuantitativa (CPA, CPM, CTR, spend, leads) y cualitativa (análisis de creativos, copy de los ads). Permite detectar patrones de segmentación geográfica y comparar rendimiento orgánico vs paid.

## Funcionalidades

### 1. Overview de Campañas
- Lista de campañas activas e históricas.
- Métricas por campaña: spend, leads, CPA, CPM, CTR, ROAS.
- Filtros por fecha, estado, objetivo.

### 2. Detalle de Ad/Creativo
- Preview del creativo (imagen o video).
- Métricas del ad individual.
- Análisis cualitativo por IA: qué dice el copy, cómo se ve el creativo, por qué funciona o no.
- Comparación con otros creativos.

### 3. Insights Geográficos
- Views/leads por país: orgánico vs ads.
- Detectar discrepancias (ej: "orgánico llega bien a España pero Ads prioriza Argentina").
- Recomendaciones de segmentación.

### 4. Tracking Automatizado
- Reemplazar el proceso manual de copiar data del Ads Manager a Google Sheets.
- Automatizar la recolección de métricas.

## Fuente de Datos
- Meta Marketing API (Facebook/Instagram Ads).
- Análisis cualitativo vía GPT-4.

## Ruta
`/ads`
