# MCP — Conexiones activas del proyecto

> Este documento describe los servidores MCP configurados en el proyecto y cómo usarlos.
> La IA debe leer este doc cuando necesite consultar la base de datos, ver el schema, o generar migraciones.

---

## Qué es MCP en este contexto

MCP (Model Context Protocol) permite que la IA se conecte directamente a servicios externos — como Supabase — desde la conversación. Sin salir al panel, sin copiar y pegar schema manualmente.

---

## MCP activo: Supabase

### Identificación
- **Nombre del servidor:** `apps-y-dash`
- **Paquete:** `@supabase/mcp-server-supabase`
- **Archivo de config (local, fuera del repo):** `C:\Users\emanu\.claude\claude_mcp_config.json`

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

- La IA **puede consultar y leer** libremente para entender el schema
- La IA **puede generar SQL** para migraciones
- Los cambios de DB **siempre van por migraciones** — nunca ejecutar cambios destructivos directo desde el MCP
- El MCP apunta al proyecto **dev/staging** para trabajo diario — nunca conectar production al MCP de trabajo

---

## Configuración en una máquina nueva

Cada developer configura el MCP localmente. El archivo **no se commitea al repo**.

Crear `C:\Users\<usuario>\.claude\claude_mcp_config.json`:

```json
{
  "mcpServers": {
    "apps-y-dash": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "TU_SUPABASE_ACCESS_TOKEN"
      ]
    }
  }
}
```

### Dónde obtener el access token
Supabase → Account → Access Tokens → Generate new token.

Si sos un developer nuevo, pedírselo al responsable del proyecto (`summit@nalify.marketing`).

### Verificar que funciona
Después de guardar el archivo, reiniciar Claude Code y pedirle:
> "Usá el MCP de Supabase para listarme las tablas del proyecto"

Si responde con las tablas reales, está funcionando.

---

## MCPs futuros

A medida que se agreguen nuevas conexiones MCP al proyecto, documentarlas en este archivo con la misma estructura:
- nombre del servidor
- qué hace
- reglas de uso
- cómo configurar

---

## Archivos relacionados

- `docs/DB_SCHEMA.md` — schema completo de la base de datos
- `docs/06-github-stages-databases-guide.md` — relación entre ambientes y Supabase
- `docs/03-security.md` — seguridad, credenciales y accesos
