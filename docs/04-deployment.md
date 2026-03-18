# Deployment — Arko

> Este documento se completa cuando el proyecto esté listo para deploy.

## Plataforma de Deploy
- **Frontend:** Vercel
- **Backend:** Supabase (Edge Functions)
- **Base de datos:** Supabase (PostgreSQL)

## Proceso de Deploy
_(Pendiente de definir)_

## Checklist Pre-Deploy
- [ ] Todas las variables de entorno configuradas en Vercel
- [ ] RLS activado en todas las tablas
- [ ] Tests críticos pasando
- [ ] Build sin errores
- [ ] Documentación actualizada
- [ ] CHANGELOG al día
- [ ] Checklist de seguridad completado (ver `03-security.md`)

## Ambientes
| Ambiente | URL | Branch | Supabase Project |
|----------|-----|--------|-----------------|
| Desarrollo | localhost:3000 | develop | (dev project) |
| Staging | TBD | staging | (staging project) |
| Producción | TBD | main | (prod project) |
