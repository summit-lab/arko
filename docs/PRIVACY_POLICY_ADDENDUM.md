# Privacy Policy Addendum — Instagram DM Tracking

> One-page addendum to be merged into Moka's public Privacy Policy (`/privacy`).
> Scope: the `instagram_business_manage_messages` feature only.
> Publish this **before** submitting the Meta App Review.

---

## Español (primario)

### Seguimiento de mensajes directos de Instagram

Cuando activás **Seguimiento de DMs** en Ajustes → Integraciones, Moka recibe notificaciones de Instagram cada vez que tu cuenta de negocio recibe un mensaje directo. Lo usamos únicamente para mostrarte cuántas conversaciones nuevas tenés por día en tu dashboard.

**Qué guardamos:**

- Fecha y hora del mensaje (`received_at`).
- ID opaco del hilo (`thread_id`, provisto por Meta).
- ID opaco del remitente (`sender_igsid`, provisto por Meta).
- Tipo de evento (mensaje o reacción).

**Qué NO guardamos:**

- El texto del mensaje.
- Imágenes, videos, audios o archivos adjuntos.
- El nombre, usuario, email o teléfono del remitente.
- Ninguna vista previa del contenido.

No tenemos bandeja de entrada. No podés leer ni responder mensajes desde Moka. No vendemos estos datos ni los compartimos con terceros. No los enviamos a modelos de IA.

**Cuánto tiempo los guardamos:**

- Eventos crudos: 90 días y se eliminan automáticamente.
- Agregados diarios (fecha + cantidad): mientras tu workspace esté activo.

**Cómo eliminarlos:**

- Desde Ajustes → Integraciones → **Eliminar datos de DMs** (inmediato).
- Desactivando el toggle de Seguimiento de DMs (cancela la suscripción y borra lo guardado).
- Revocando el acceso desde [Configuración de Facebook → Integraciones de Negocio](https://www.facebook.com/settings?tab=business_tools).
- Solicitando eliminación completa de tu cuenta a `support@usearko.io`.

Moka también responde al Data Deletion Callback de Meta: si pedís la eliminación desde el panel de Meta, borramos tus datos de DMs automáticamente.

**Contacto:** [support@usearko.io](mailto:support@usearko.io)

---

## English

### Instagram Direct Message tracking

When you enable **DM tracking** in Settings → Integrations, Moka receives a notification from Instagram each time your business account gets a direct message. We use this data for one purpose only: to show you how many new conversations you receive per day on your dashboard.

**What we store:**

- Message timestamp (`received_at`).
- Opaque thread ID (`thread_id`, provided by Meta).
- Opaque sender ID (`sender_igsid`, provided by Meta).
- Event type (message or reaction).

**What we do NOT store:**

- The message text.
- Images, videos, audio, or attachments.
- The sender's name, username, email, or phone.
- Any preview of the message content.

Moka has no inbox. You cannot read or reply to messages from Moka. We do not sell this data, share it with third parties, or send it to AI models.

**Retention:**

- Raw events: 90 days, then automatically deleted.
- Daily aggregates (date + count): kept while your workspace is active.

**How to delete this data:**

- Settings → Integrations → **Delete DM data** (immediate).
- Turn off the DM tracking toggle (unsubscribes the webhook and purges stored data).
- Revoke access from [Facebook Settings → Business Integrations](https://www.facebook.com/settings?tab=business_tools).
- Email `support@usearko.io` to request full account deletion.

Moka also honors Meta's Data Deletion Callback: if you request deletion from Meta's dashboard, your DM data is purged automatically.

**Contact:** [support@usearko.io](mailto:support@usearko.io)
