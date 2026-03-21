# Guía Maestra de GitHub — Arko

> Este documento explica, en lenguaje simple, cómo se maneja Arko a nivel operativo desde GitHub.
> Está pensado para humanos y para asistentes de IA.
> Si una tarea toca GitHub, ramas, commits, Pull Requests, merges, releases, staging, producción, Supabase o migraciones, esta guía debe leerse antes de actuar.

---

## 1. Objetivo de esta guía

Esta guía responde las preguntas clave de operación del repositorio:

1. ¿Cómo trabajamos con GitHub?
2. ¿Qué ramas existen y para qué sirve cada una?
3. ¿Cómo se hace un commit, push, PR y merge correctamente?
4. ¿Cómo se relaciona GitHub con local, staging y production?
5. ¿Cómo se relaciona GitHub con Supabase y la base de datos?
6. ¿Qué tiene que hacer la IA en cada caso?

La idea es evitar confusión, evitar romper producción y evitar que cada persona o IA improvise su propio flujo de GitHub.

---

## 2. Mapa simple del proyecto desde GitHub

Pensalo así:

- **Tu computadora** = `local`
- **Servidor de prueba** = `staging`
- **Servidor real** = `production`

Y del lado del código / repositorio:

- **`feature/*` / `fix/*` / `docs/*` / `chore/*`** = ramas de trabajo
- **`develop`** = rama de integración del equipo
- **`main`** = rama de producción
- **Pull Request** = puerta de entrada de cambios importantes
- **CI / GitHub Actions** = validación automática antes del merge

Y del lado de la base de datos:

- **Supabase staging/dev** = base segura para probar
- **Supabase production** = base real de usuarios

---

## 3. Regla principal del proyecto

### Regla operativa

- En **local** construimos
- En **staging** verificamos
- En **production** publicamos

### Regla de GitHub

- No trabajar directo sobre `main`
- Evitar trabajar directo sobre `develop`
- Cada cambio va en una rama propia
- Todo cambio importante entra por Pull Request
- GitHub es la fuente de verdad del historial del proyecto

### Regla de base de datos

- Nunca cambiar schema manualmente en producción
- Los cambios de DB se hacen con **migraciones**
- Primero se prueban en staging
- Después se aplican en production

### Regla de documentación

- Si un cambio modifica cómo trabajamos en GitHub, esa regla debe quedar documentada en esta guía
- Si un cambio afecta setup, ambientes, DB, seguridad o deploy, no alcanza con cambiar código: también hay que actualizar docs

---

## 4. GitHub — cómo se trabaja

## 4.1 Qué representa GitHub en Arko

GitHub no es solo donde se guarda el código.
En Arko, GitHub cumple estas funciones:

- guardar el historial real del proyecto
- ordenar ramas y releases
- centralizar Pull Requests
- disparar CI
- dejar trazabilidad de cambios operativos
- conectar el trabajo local con staging y producción

## 4.2 Ramas canónicas

- **`main`** → producción
- **`develop`** → integración del equipo
- **`feature/<nombre>`** → funcionalidad nueva
- **`fix/<nombre>`** → bugfix
- **`docs/<nombre>`** → documentación
- **`chore/<nombre>`** → mantenimiento técnico

## 4.3 Flujo correcto

### Caso normal

1. Actualizar `develop`
2. Crear una rama nueva desde `develop`
3. Trabajar en esa rama
4. Validar localmente
5. Hacer commit
6. Hacer push
7. Abrir Pull Request hacia `develop`
8. Revisar staging
9. Cuando todo está estable, pasar a `main`

## 4.4 Qué NO hacer

- No desarrollar directo en `main`
- No empujar cambios improvisados a producción
- No mezclar 5 temas distintos en un mismo PR
- No abrir PR sin documentación si el cambio afecta operación, DB, API o seguridad
- No usar GitHub como backup caótico de cambios sin contexto

## 4.5 Recomendación práctica para el equipo

Para ustedes, lo más simple es:

- **GitHub Desktop** para ramas, commits, push y ver diffs
- **IA** para programar, documentar, revisar archivos y guiar el proceso

### Uso recomendado

**GitHub Desktop**:
- crear rama
- ver archivos modificados
- escribir commit
- push
- cambiar de rama
- abrir el PR en GitHub

**IA**:
- implementar cambios
- explicar el flujo correcto
- actualizar docs
- actualizar changelog
- decir qué tocar antes de hacer merge

## 4.6 Commits — cómo deben pensarse

Un commit correcto debe representar una idea clara.

### Buenos ejemplos

- `feat: agrega sistema centralizado de ambientes`
- `fix: corrige redirect de meta callback en staging`
- `docs: agrega guía maestra de github`

### Malos ejemplos

- `cambios`
- `fix`
- `todo`

Regla práctica:

- un commit debe poder entenderse sin explicación oral
- si el cambio mezcla cosas no relacionadas, separar commits

## 4.7 Pull Requests — para qué sirven

Un Pull Request sirve para:

- revisar cambios antes de integrarlos
- dejar contexto del cambio
- documentar impacto
- verificar CI
- discutir riesgos antes del merge

En Arko, el PR no es opcional para cambios relevantes.

## 4.8 Qué debe revisar la IA antes de cerrar un PR

- si el objetivo del PR es claro
- si el alcance está acotado
- si las docs fueron actualizadas
- si hubo impacto en DB, API, seguridad o ambientes
- si el changelog fue actualizado
- si el branch destino es correcto (`develop` o excepcionalmente `main`)

## 4.9 Cómo pasa un cambio por GitHub

El ciclo correcto es:

1. local
2. branch
3. commit
4. push
5. Pull Request
6. CI
7. merge a `develop`
8. validación en staging
9. merge/release a `main`

---

## 5. GitHub y los ambientes — qué significa cada uno

## 5.1 Local

Es tu computadora.

### Se usa para
- desarrollar
- probar rápido
- iterar con la IA

### Variables típicas
```env
APP_ENV=local
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Base de datos
Lo recomendado es que local apunte a la **base de staging/dev**, no a producción.

### Relación con GitHub
En local trabajás en una rama propia. Local no reemplaza a GitHub: es tu espacio de trabajo antes del commit y push.

---

## 5.2 Staging

Es el ambiente de prueba del equipo.

### Se usa para
- validar integración
- probar features antes de publicar
- revisar que deploy, auth, redirects, callbacks y conexiones funcionen bien

### Variables típicas
```env
APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.tudominio.com
```

### Base de datos
Staging debe usar una **base separada de producción**.

Si staging usa la misma DB que producción, entonces no es staging real.

### Relación con GitHub
Staging normalmente valida lo que se integró en `develop`.

---

## 5.3 Production

Es el ambiente real.

### Se usa para
- usuarios reales
- datos reales
- deploy estable

### Variables típicas
```env
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://app.tudominio.com
```

### Base de datos
Production usa su **propia base real**.
Nunca debería compartir DB con staging.

### Relación con GitHub
Production representa lo aprobado para `main`.

---

## 6. GitHub y Supabase — cómo lo manejamos

## 6.1 Modelo recomendado para Arko

La recomendación operativa del proyecto es usar **2 proyectos Supabase**:

- **Supabase staging/dev**
- **Supabase production**

### Distribución recomendada

- **local** → Supabase staging/dev
- **staging** → Supabase staging/dev
- **production** → Supabase production

Con eso ya tienen una estructura profesional sin complicarse con 3 bases distintas.

## 6.2 Qué significa eso en práctica

### Supabase staging/dev
Sirve para:
- desarrollar
- probar migraciones
- testear auth
- probar integraciones con Meta, OpenAI, Apify, etc.
- cometer errores sin afectar usuarios reales

### Supabase production
Sirve para:
- usuarios reales
- datos reales
- operaciones reales del negocio

---

## 6.3 ¿Se sincronizan las bases automáticamente?

**No.**

Lo que se sincroniza bien es la **estructura**, no los datos.

### Sí se sincroniza
- tablas
- columnas
- índices
- RLS
- triggers
- funciones SQL
- edge functions
- tipos generados

### No se sincroniza automáticamente
- filas de datos
- usuarios reales
- archivos de storage
- tokens
- registros operativos

---

## 6.4 Entonces, ¿cómo se mantiene igual staging y production?

Con **migraciones**.

### Flujo correcto de DB

1. Hacer cambio de schema en una migración nueva
2. Aplicar esa migración en staging
3. Probar
4. Si todo está bien, aplicar la misma migración en production
5. Actualizar `docs/DB_SCHEMA.md`
6. Actualizar `CHANGELOG.md`
7. Dejar trazabilidad del cambio en GitHub (commit + PR)

---

## 6.5 Qué NO hacer con la base de datos

- No editar manualmente tablas en producción como forma normal de trabajo
- No cambiar políticas RLS “rápido” sin documentación
- No crear columnas solo desde el panel y olvidarse de la migración
- No usar production para testear experimentos

---

## 7. Qué tiene que hacer la IA cuando una tarea toca GitHub

## 7.1 Si la tarea toca GitHub o ramas

La IA debe:
- leer esta guía
- leer `docs/features/team-collaboration.md`
- respetar `develop` como integración y `main` como producción
- no sugerir trabajo directo sobre `main`
- recordar actualizar docs y changelog

## 7.2 Si la tarea toca Pull Requests, merges o releases

La IA debe:
- confirmar rama origen y rama destino
- confirmar si el cambio debe ir a `develop` o a `main`
- recordar que staging debe validarse antes de pensar en producción
- recordar que un merge cambia el estado oficial del repositorio

## 7.3 Si la tarea toca ambientes o variables

La IA debe:
- leer `docs/05-environments-guide.md`
- usar `src/lib/env.ts`
- no hardcodear URLs
- no usar `process.env` directo en código de negocio

## 7.4 Si la tarea toca base de datos

La IA debe:
- leer `docs/DB_SCHEMA.md`
- usar migraciones
- nunca asumir que staging y production comparten DB
- avisar explícitamente si hay impacto en schema, RLS, RPC o datos

## 7.5 Si la tarea toca deploy

La IA debe:
- leer `docs/04-deployment.md`
- confirmar ambiente destino
- confirmar variables correctas
- confirmar proyecto Supabase correcto
- no hacer deploy sin validación explícita

---

## 8. Qué tiene que hacer una persona del equipo

## 8.1 Cuando empieza una tarea

1. Actualizar `develop`
2. Crear rama nueva
3. Explicarle a la IA qué quiere hacer
4. Dejar que la IA implemente
5. Probar local
6. Confirmar docs/changelog
7. Commit + push
8. Abrir PR a `develop`

## 8.2 Cuando la tarea toca base de datos

1. Confirmar si el cambio es realmente necesario
2. Crear migración
3. Probar en staging/dev
4. Verificar que no rompa auth, RLS o queries existentes
5. Documentar en `docs/DB_SCHEMA.md`
6. Recién después pensar en production

## 8.3 Antes de pasar a producción

- `develop` debe estar estable
- staging debe haber sido probado
- variables de entorno correctas
- proyecto Supabase correcto
- docs actualizadas
- changelog actualizado
- sin secretos expuestos

---

## 9. Flujo operativo completo del proyecto desde GitHub

## 9.1 Cambio normal sin DB

1. Rama desde `develop`
2. Cambio local
3. Test local
4. Commit
5. Push
6. PR a `develop`
7. Validación en staging
8. Merge a `main` cuando corresponda

## 9.2 Cambio con DB

1. Rama desde `develop`
2. Crear migración
3. Aplicar en Supabase staging/dev
4. Probar local y staging
5. Actualizar `docs/DB_SCHEMA.md`
6. Actualizar `CHANGELOG.md`
7. PR a `develop`
8. Validar
9. Aplicar misma migración en production cuando se apruebe release

## 9.3 Cambio de variables / ambiente

1. Cambiar `.env.local` si es local
2. Cambiar variables del proveedor si es staging/production
3. No tocar código salvo que falte agregar una nueva variable al sistema
4. Si se crea una variable nueva:
   - actualizar `.env.example`
   - actualizar `src/lib/env.ts`
   - actualizar `docs/05-environments-guide.md`
   - actualizar esta guía si afecta operación

---

## 10. Qué falta para que el sistema quede redondo

A nivel operativo, lo pendiente más importante es:

- definir el **Supabase staging/dev** si todavía no está separado de producción
- confirmar qué proyecto queda como **production**
- configurar variables por ambiente en el proveedor de deploy
- confirmar URLs reales de staging y production
- configurar callbacks externos por ambiente (por ejemplo Meta OAuth)
- mantener la disciplina de migraciones + documentación

---

## 11. Resumen ultra corto

Si te perdés, acordate de esto:

- **local** = construir
- **staging** = probar
- **production** = publicar

- **develop** = integración
- **main** = producción

- **staging DB** = pruebas
- **production DB** = real

- **los cambios de DB se mueven con migraciones**
- **los ambientes se cambian con variables, no con hardcodes**
- **la IA debe leer esta guía antes de actuar en temas operativos**

---

## 12. Archivos relacionados

- `docs/features/team-collaboration.md`
- `docs/04-deployment.md`
- `docs/05-environments-guide.md`
- `docs/03-security.md`
- `docs/DB_SCHEMA.md`
- `.windsurfrules`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `CHANGELOG.md`
