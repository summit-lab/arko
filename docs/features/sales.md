# Feature: Ventas

## Descripción
Módulo para trackear la facturación generada desde el contenido del creator — reels, historias, posts, link en bio u otras fuentes. Sección `/ventas`.

## Modelos

### `sales`
Una venta = un deal cerrado. Campos principales:
- `amount_total`: deal total acordado
- `amount_collected`: monto cobrado hasta ahora (autoritativo: recalculado por trigger cuando se usan cuotas)
- `payment_type`: `full` (pago completo), `cuotas` (N pagos programados), `deposito` (seña + saldo)
- `payment_status`: `collected` / `pending` / `cancelled`
- `sale_date`: fecha del deal
- `source_type` + `source_label` + `reel_id` / `story_sequence_id`: qué contenido generó la venta
- `client_name` opcional

### `sale_installments` — cuotas programadas
Solo se llenan cuando `payment_type='cuotas'`. Una fila por cuota:
- `installment_number`: 1..N
- `due_date`: fecha de vencimiento
- `amount`: monto de esa cuota (la última compensa decimales)
- `paid_at`: null = pendiente. Cuando tiene valor = cobrada.

## Auto-paid + recálculo

- **Al crear venta con cuotas**: el endpoint POST `/api/sales` genera las N filas. El usuario elige `first_installment_date` (default: `sale_date` si la deja vacía). Primera cuota = `first_installment_date`, siguientes = **+30 días exactos** entre cada una. Las cuotas cuyo `due_date <= hoy` se marcan como `paid_at = due_date` al insertar (evita esperar al cron para que queden reflejadas).
- **pg_cron diario** (`auto-pay-installments-daily`, 00:05 UTC): marca como cobradas las cuotas con `due_date <= hoy` y `paid_at IS NULL`. Asume que se cobraron en la fecha; si el cliente no pagó realmente, el usuario desmarca manualmente.
- **Trigger `recalc_sale_from_installments`** (INSERT/UPDATE/DELETE on `sale_installments`): recalcula `sales.amount_collected = SUM(amount WHERE paid_at IS NOT NULL)` y actualiza `payment_status`.

## UI

- Tabla principal en `/ventas` con filtro de fechas, KPIs (facturación / efectivo / por cobrar), gráfico mensual.
- Click en ícono Wallet de una venta:
  - Si `payment_type='cuotas'` → `InstallmentsModal`: lista de cuotas con fecha, monto, estado. Toggle paid/pending por cuota.
  - Si no (depósito/full) → `AddPaymentModal`: input manual de monto + fecha.

## API

- `GET /api/sales` → lista de ventas del workspace (últimas 200).
- `POST /api/sales` → crea venta. Si `payment_type='cuotas'`, requiere `n_cuotas` y genera las filas.
- `PATCH /api/sales/[id]` → edita campos de la venta.
- `DELETE /api/sales/[id]` → elimina (cascade a installments).
- `GET /api/sales/[id]/installments` → lista de cuotas de la venta.
- `PATCH /api/sales/[id]/installments` → toggle paid/unpaid. Body: `{ installment_id, paid, paid_at? }`. Devuelve `{ installment, sale }` con la venta ya recalculada.

## Decisiones

- **Frecuencia +30 días**: intervalos fijos de 30 días entre cuotas (antes era "mismo día del mes"). Simplifica la UI (una sola fecha) y evita ambigüedad del día 31. El trigger de DB sigue igual — solo cambia cómo se llenan los `due_date` al insertar.
- **Sin input de cobro upfront**: el usuario solo elige la fecha de la primera cuota. Las cuotas con `due_date <= hoy` se marcan paid automáticamente al insertar; el cron diario se encarga del resto a futuro.
- **Auto-paid optimista**: el cron no verifica pagos reales — asume cobradas al vencer. Pensado para creators con cobro automático (Stripe / Mercado Pago debit) o para el caso común donde sí se cobra. El usuario corrige manualmente los casos que fallan.
- **Límite**: máximo 60 cuotas por venta (sanity cap en el endpoint).
- **No rollback**: si la venta se crea pero falla el insert de installments, la venta queda sin cuotas. Log del error; el usuario puede regenerarlas manualmente si hace falta (TODO futuro).

## Archivos

- `src/app/api/sales/route.ts` — GET/POST ventas
- `src/app/api/sales/[id]/route.ts` — PATCH/DELETE venta individual
- `src/app/api/sales/[id]/installments/route.ts` — GET/PATCH cuotas
- `src/app/(dashboard)/ventas/page.tsx` + `VentasClient.tsx` — UI principal
- `src/components/sales/SaleForm.tsx` + `SaleFormModal.tsx` — creación
- `src/components/sales/InstallmentsModal.tsx` — gestión de cuotas
- `src/components/sales/AddPaymentModal.tsx` — cobros manuales (no-cuotas)
- `supabase/migrations/20260423000054_sale_installments.sql` — tabla + trigger + cron
