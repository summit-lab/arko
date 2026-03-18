# Skills Instaladas

> Última actualización: 2026-03-17
> Este archivo registra todas las skills, extensiones, MCP servers y herramientas
> especializadas disponibles en el entorno de desarrollo.

---

## ¿Qué son las Skills?

Las skills son capacidades especializadas que la IA puede usar para implementar
funcionalidades de forma más eficiente y correcta. Antes de implementar cualquier
feature, la IA DEBE consultar este archivo para verificar si existe una skill
relevante.

---

## Skills Activas

| # | Nombre | Tipo | Descripción | Usar cuando |
|---|--------|------|-------------|-------------|
| 1 | n8n-code-javascript | skill | Escribir código JavaScript en nodos de código n8n | Integración con n8n workflows |
| 2 | n8n-code-python | skill | Escribir código Python en nodos de código n8n | Integración con n8n workflows (Python) |
| 3 | n8n-expression-syntax | skill | Validar sintaxis de expresiones n8n | Trabajar con expresiones n8n |
| 4 | n8n-mcp-tools-expert | skill | Guía experta para herramientas n8n-mcp | Buscar nodos, validar configs, gestionar workflows |
| 5 | n8n-node-configuration | skill | Configuración de nodos n8n con awareness de operaciones | Configurar nodos n8n |
| 6 | n8n-validation-expert | skill | Interpretar errores de validación n8n | Errores de validación en workflows |
| 7 | n8n-workflow-patterns | skill | Patrones arquitectónicos de workflows n8n | Diseñar estructura de workflows |
| 8 | find-skills | skill | Descubrir e instalar skills de agente | Buscar funcionalidad que podría existir como skill |

---

## MCP Servers Conectados

| # | Servidor | Herramientas | Descripción | Usar cuando |
|---|----------|-------------|-------------|-------------|
| 1 | summit (Supabase) | apply_migration, execute_sql, list_tables, deploy_edge_function, etc. | Gestión completa de Supabase (DB, migrations, Edge Functions, auth) | Cualquier operación con Supabase |
| 2 | n8n-mcp | Herramientas n8n | Gestión de workflows n8n | Automatizaciones y workflows |

---

## Historial de Skills

| Fecha | Acción | Skill | Motivo |
|-------|--------|-------|--------|
| 2026-03-17 | Registradas | Todas las anteriores | Setup inicial del proyecto Arko |
