# Seguridad — Arko

## Autenticación
- **Método:** Supabase Auth (email/password + OAuth providers)
- **Flujo:** Login → JWT → Supabase Client con token → RLS valida acceso
- **Tokens:** Access token (corta duración) + Refresh token (larga duración), manejados automáticamente por Supabase Client
- **Sesiones:** Persistidas en cookies httpOnly (SSR) y localStorage (CSR)

## Autorización
- **Modelo:** Row Level Security (RLS) en PostgreSQL
- **Principio:** Cada usuario solo puede acceder a sus propios datos
- **Roles:**
  - `authenticated` — Usuario logueado (acceso a sus datos)
  - `anon` — Usuario no autenticado (acceso solo a rutas públicas)
  - `service_role` — Solo server-side (Edge Functions, API Routes con service key)

## Variables de Entorno

### Públicas (expuestas al cliente)
| Variable | Riesgo si se expone | Mitigación |
|----------|---------------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Bajo — URL pública | RLS protege los datos |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Bajo — solo permite operaciones autorizadas por RLS | RLS + políticas estrictas |
| `NEXT_PUBLIC_APP_URL` | Bajo — URL pública | Ninguna necesaria |

### Privadas (NUNCA exponer al cliente)
| Variable | Riesgo si se expone | Protección |
|----------|---------------------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` | CRÍTICO — bypass de RLS | Solo en server-side (API Routes, Edge Functions) |
| `OPENAI_API_KEY` | ALTO — consumo de API con costo | Solo en server-side |
| `INSTAGRAM_CLIENT_SECRET` | ALTO — acceso a API de Instagram | Solo en server-side |
| `YOUTUBE_API_KEY` | MEDIO — acceso a YouTube Data API | Solo en server-side |
| `META_ADS_ACCESS_TOKEN` | ALTO — acceso a datos de Meta Ads | Solo en server-side |

## Reglas INVIOLABLES
- NUNCA hardcodear credenciales en código fuente
- NUNCA exponer `SUPABASE_SERVICE_ROLE_KEY` en el cliente
- NUNCA desactivar RLS sin autorización explícita
- NUNCA hacer deploy sin checklist de seguridad
- SIEMPRE validar input en servidor (no confiar en cliente)
- SIEMPRE usar tipos para prevenir inyección
- SIEMPRE usar prepared statements / query builders (Supabase client lo hace automáticamente)
- SIEMPRE sanitizar datos de transcripciones y contenido externo antes de almacenar

## Checklist de Seguridad Pre-Deploy
- [ ] `.env.local` está en `.gitignore`
- [ ] `.env.example` tiene TODAS las variables (sin valores reales)
- [ ] Las variables del servidor NO están expuestas al cliente
- [ ] Las API keys de terceros tienen scopes mínimos necesarios
- [ ] `anon key` en cliente, `service role key` SOLO en server
- [ ] RLS activado en TODAS las tablas con datos de usuario
- [ ] Todas las políticas RLS documentadas en `DB_SCHEMA.md`
- [ ] Input validation en todos los formularios (client + server)
- [ ] Rate limiting en endpoints públicos
- [ ] CORS configurado correctamente

## Datos Sensibles del Usuario
- Tokens de APIs sociales (Instagram, YouTube, Meta Ads) → encriptados en DB
- Transcripciones de llamadas de ventas → acceso solo por el owner (RLS)
- Métricas de negocio → acceso solo por el owner (RLS)
- Datos de clientes (Customer Voice) → acceso solo por el owner (RLS)
