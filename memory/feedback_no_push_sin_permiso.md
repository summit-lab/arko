---
name: No hacer push sin permiso explícito
description: Nunca ejecutar git push a ninguna rama sin que el usuario lo pida explícitamente
type: feedback
---

Nunca ejecutar `git push` sin que el usuario lo pida explícitamente.

**Why:** El usuario fue claro y molesto por un push que hice sin pedírselo. El control del push/merge es del humano, no de la IA.

**How to apply:** Después de commitear, siempre reportar el estado y esperar instrucción explícita de push. No asumir que "commitear" implica pushear.
