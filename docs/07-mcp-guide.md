# MCP — Conexiones activas del proyecto

> Este documento describe los servidores MCP configurados en el proyecto y cómo usarlos.
> La IA debe leer este doc cuando necesite consultar la base de datos, ver el schema, o generar migraciones.

---

## Qué es MCP en este contexto

MCP (Model Context Protocol) permite que la IA se conecte directamente a servicios externos — como Supabase — desde la conversación. Sin salir al panel, sin copiar y pegar schema manualmente.

---

## MCP activo: Supabase

### Identificación
- **Nombre del servidor:** `arko`
- **Paquete:** `@supabase/mcp-server-supabase`
- **Archivo de config:** `.mcp.json` (raíz del repo — se commitea)
- **Token:** lee `SUPABASE_ACCESS_TOKEN` desde las variables de entorno del sistema

### Qué puede hacer la IA con este MCP

| Capacidad | Descripción |
|-----------|-------------|
| Consultar tablas | Ver estructura y datos de cualquier tabla |
| Ejecutar SQL | Queries, joins, agregaciones directamente |
| Ver schema | Columnas, tipos, índices, RLS policies |
| Generar migraciones | SQL preciso basado en el schema real |
| Generar tipos TypeScript | Tipos alineados al schema actual |
| Ver logs | Debugging de queries y funciones edge |

### Reglas de uso

- La IA **puede consultar y leer** libremente para entender el schema (en ambos proyectos)
- La IA **puede generar SQL** para migraciones
- **Durante desarrollo:** la IA **solo aplica migraciones en Dev Arko** (`hrsvglgswatwklivkoyp`). Prod Arko es solo lectura.
- **Durante release:** cuando el developer pide explícitamente un deploy a producción, la IA puede aplicar migraciones en Prod Arko (`zphvrohosizkbrnxtppj`) siguiendo el protocolo de release (listar, mostrar SQL, pedir confirmación, aplicar de a una).
- Ver `CLAUDE.md` sección 7 para las reglas completas y el protocolo de release.

---

## Cómo funciona la configuración

### Scope: solo proyecto (no global)

El MCP está configurado **únicamente** en `.mcp.json` (raíz del repo) con scope `project`. **No está configurado globalmente** — cada proyecto tiene sus propios MCPs.

Regla: nunca usar `claude mcp add --scope user` para este servidor. Si accidentalmente se agrega globalmente, eliminarlo con:
```bash
claude mcp remove arko --scope user
```

### Archivo de config actual

```json
{
  "mcpServers": {
    "arko": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
      ]
    }
  }
}
```

> El token real está en `.mcp.json`. Este archivo **no se commitea al repo** (está en `.gitignore`).

### Verificar que está conectado
```bash
claude mcp list
```
Debe aparecer `arko: ... - ✓ Connected`.

---

## Configuración en una máquina nueva

### 1. Obtener el access token
Supabase → Account → Access Tokens → Generate new token.

Si sos un developer nuevo, pedírselo al responsable del proyecto (`summit@nalify.marketing`).

### 2. Crear el `.mcp.json` en la raíz del proyecto
```json
{
  "mcpServers": {
    "arko": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_tu_token_aqui"
      ]
    }
  }
}
```

### 3. Verificar que funciona
Reiniciar Claude Code y correr:
```bash
claude mcp list
```
Si aparece `✓ Connected`, está listo.

---

## MCPs futuros

A medida que se agreguen nuevas conexiones MCP al proyecto, documentarlas en este archivo con la misma estructura:
- nombre del servidor
- qué hace
- reglas de uso
- cómo configurar

Agregar el servidor en `.mcp.json` y la variable en `.env.example`.

---

## Cron jobs (Supabase pg_cron)

| Edge function | Schedule (UTC) | AR local | Descripción |
|---|---|---|---|
| `aggregate-conversations` | `0 4 * * *` | 01:00 | Agrega `ig_conversation_events` del día anterior en `ig_daily_conversations`. TODO manual: agregar este cron en Dev y Prod. |

---

## Archivos relacionados

- `.mcp.json` — configuración de MCPs del proyecto (se commitea)
- `.env.example` — template con `SUPABASE_ACCESS_TOKEN`
- `docs/DB_SCHEMA.md` — schema completo de la base de datos
- `docs/06-github-stages-databases-guide.md` — relación entre ambientes y Supabase
- `docs/03-security.md` — seguridad, credenciales y accesos
