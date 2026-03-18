# Documentación de API

**Base URL:** `/api/v1`
**Autenticación:** Bearer Token (JWT via Supabase Auth)
**Última actualización:** 2026-03-17 19:58

---

## Autenticación

Endpoints protegidos requieren:
```
Authorization: Bearer {access_token}
```

---

## Índice de Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | /api/v1/health | Estado del servidor | NO |

---

## Formato de Respuestas

### Exitosa
```json
{
  "data": { },
  "message": "Operación exitosa"
}
```

### Paginada
```json
{
  "data": [ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error
```json
{
  "error": "Tipo de error",
  "message": "Descripción del error",
  "details": { }
}
```

---

## Endpoints

### Health Check

**`GET /api/v1/health`** — Sin autenticación

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-17T19:58:00Z"
}
```

---

## Códigos de Error Globales

| Código | Descripción |
|--------|-------------|
| 400 | Datos inválidos |
| 401 | Token inválido/expirado |
| 403 | Sin permisos |
| 404 | No encontrado |
| 429 | Rate limit excedido |
| 500 | Error del servidor |
