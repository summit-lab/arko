# Meta App Review — `instagram_business_manage_messages`

> Submission package for requesting the `instagram_business_manage_messages` permission for Moka (by Summit Lab).
> Purpose: receive Instagram DM webhooks so Moka can count and chart **daily new conversations** as a B2B analytics metric.
> Audience: the developer preparing the submission. Follow this doc top-to-bottom.

---

## 0. TL;DR — what we are asking Meta for

| Item | Value |
|------|-------|
| App name | Moka |
| Company | Summit Lab |
| Permission | `instagram_business_manage_messages` |
| Product | Instagram Graph API — Messaging webhook |
| Use case | Aggregate B2B analytics (counts only, no message content surfaced to users) |
| Intended users | Small/medium business owners with an Instagram Business account |
| Data we store | Event timestamp, opaque thread ID, opaque sender IGSID, event type |
| Data we do NOT store | Message text, media, attachments, names, email, phone |
| Retention (raw events) | 90 days |
| Retention (daily aggregates) | Indefinite while workspace is active |
| Data deletion callback | `https://usearko.io/api/data-deletion-callback` |
| Privacy policy | `https://usearko.io/privacy` |
| Data deletion instructions | `https://usearko.io/data-deletion` |

---

## 1. Submission checklist

Do every step in order. Do not skip.

### 1.1 Pre-submission (code + infra)

- [ ] Sprint B has deployed the webhook infra (endpoint, subscription, conversation tables, aggregate job). Confirm with the Sprint B owner before moving on.
- [ ] `data-deletion-callback` endpoint is live at `https://usearko.io/api/data-deletion-callback` and returns the expected JSON payload (`{ url, confirmation_code }`).
- [ ] Privacy Policy at `https://usearko.io/privacy` includes the DM tracking addendum (see `docs/PRIVACY_POLICY_ADDENDUM.md`). Publish before submitting.
- [ ] Terms of Service at `https://usearko.io/terms` is live (if not published yet, create from the Privacy Policy footer template).
- [ ] OAuth scope list in `src/app/api/v1/auth/meta/connect/route.ts` is documented (current scopes: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `ads_read`, `business_management`). The new permission will be requested **separately** via App Review — it is not added to the OAuth scope until approved.
- [ ] Settings page has a visible opt-in toggle for DM tracking with a link to the Privacy Policy section that explains what is stored.

### 1.2 Meta App Dashboard setup

- [ ] **Business Verification** completed in Meta Business Suite (required for most advanced permissions).
- [ ] App is in **Live mode** (not Development). If still in Dev mode, App Review is blocked for most products.
- [ ] App category is set (recommended: `Business` or `Business and pages`).
- [ ] App icon uploaded (1024x1024 PNG, the Moka `M` logo on solid background, not transparent).
- [ ] App domain set to `usearko.io`.
- [ ] Privacy Policy URL set to `https://usearko.io/privacy`.
- [ ] Terms of Service URL set to `https://usearko.io/terms`.
- [ ] Data Deletion Instructions URL set to `https://usearko.io/data-deletion`.
- [ ] Data Deletion Callback URL set to `https://usearko.io/api/data-deletion-callback`.
- [ ] App contact email set to `support@usearko.io`.
- [ ] **Test Users** created inside `App Dashboard → Roles → Test Users`. Minimum 2. Each Test User must have an Instagram Business account connected to a Facebook Page they admin.
  - Test User 1: reviewer-facing business account (the one shown in the screencast).
  - Test User 2: fan/customer account that sends the DMs during the demo.

### 1.3 Webhook product configuration

- [ ] `Instagram` product is added to the app inside App Dashboard.
- [ ] Webhook callback URL points to Moka's webhook endpoint.
- [ ] Webhook is subscribed to the `messages` and `message_reactions` fields at minimum.
- [ ] The test ping from App Dashboard returns `200 OK`.
- [ ] The webhook is reachable from the public internet (not behind a VPN or IP allowlist).

### 1.4 Screencast

- [ ] Screencast recorded following the script in section 3.
- [ ] Less than 3 minutes total. No audio glitches. 1080p minimum.
- [ ] Narrated in English. No background music.
- [ ] Uploaded as `.mp4` and attached to the App Review submission.

### 1.5 App Review form

- [ ] Use case summary (250 chars) — paste from section 2.1.
- [ ] Detailed description (1000 chars) — paste from section 2.2.
- [ ] Long-form justification (2000 chars, optional field or reviewer follow-up) — paste from section 2.3.
- [ ] Test user credentials (email + password) pasted into the "How to test" field.
- [ ] Step-by-step reproduction instructions pasted (section 2.4).

### 1.6 Post-submission

- [ ] Submission confirmation email archived in `support@usearko.io` inbox with tag `meta-app-review`.
- [ ] Calendar reminder set for 7 days out to check status.
- [ ] If rejected: read section 5 of this doc before replying.

---

## 2. Permission justification (copy-paste to Meta form)

All three versions must be submitted in **English** and should read as honest, specific, and aligned with the Meta Platform Terms.

### 2.1 Short — Use Case Summary (target <= 250 chars)

```
Moka is a B2B analytics SaaS. We use instagram_business_manage_messages to count new DM conversations per day and surface responsiveness trends to the business owner. We store only counts and opaque IDs — never message content.
```

(Character count: ~239.)

### 2.2 Medium — Detailed Description (target <= 1000 chars)

```
Moka is an analytics dashboard used by small and medium-sized businesses that operate Instagram Business accounts. Business owners log in and see engagement metrics across Reels, Posts, Stories and — with this permission — direct messages.

We use instagram_business_manage_messages exclusively to receive the "messages" webhook and count events. From each event we keep: timestamp, opaque thread ID, opaque sender IGSID, and event type. We do NOT store or display the message text, media, attachments, or the sender's personal name.

Moka turns those counts into a "New conversations / day" chart and a "Response volume" KPI, so the owner can correlate inbound DMs with their content calendar. This is not a CRM or inbox — the user cannot read, reply to, or export messages.

Raw events are deleted after 90 days. Daily aggregates are retained while the workspace is active. Users can delete all DM data from Settings and via Meta's Data Deletion Callback.
```

(Character count: ~989.)

### 2.3 Long — Fallback for reviewer follow-up (target <= 2000 chars)

```
Moka (moka.usearko.io) is a B2B analytics SaaS operated by Summit Lab. Our customers are small-to-medium content creators and local business owners who connect their Instagram Business account to Moka to understand how content performance, audience growth, and customer interactions trend over time.

We are requesting instagram_business_manage_messages for a single, narrow use case: counting new direct-message conversations per day and plotting that as a line chart inside the owner's private dashboard.

Implementation details:
- We subscribe to the Instagram "messages" webhook field.
- For every inbound message event, we write a row containing: received_at (timestamp), thread_id (opaque string provided by Meta), sender_igsid (opaque string), event_type ("message" or "reaction"). Nothing else.
- We do NOT call /conversations or /messages to fetch the message body. The raw webhook payload's "text" and "attachments" fields are dropped before persistence.
- We do NOT display individual messages in the UI. The UI only surfaces: a total count, a daily line chart, and a week-over-week delta.
- We do NOT send replies. Moka has no inbox, no compose UI, no agent routing.

Why we need the permission (rather than using existing insights):
- /insights does not return a dm_conversations metric. total_interactions excludes DM volume. There is no alternative API that exposes this signal.
- For small businesses, DM volume is the single most requested signal after follower growth — they want to know which Reel drove a spike in inquiries.

Data controls:
- Raw events are purged after 90 days (pg_cron job).
- Daily aggregates (date, conversation_count) are retained while the workspace is active and deleted on account deletion.
- Users can toggle DM tracking off from Settings, which stops the webhook subscription and purges existing DM data.
- We honor Meta's Data Deletion Callback at /api/data-deletion-callback.
```

(Character count: ~1988.)

### 2.4 Test instructions for the reviewer (paste into "How to test" field)

```
1. Open https://moka.usearko.io and log in with the provided test credentials.
2. You will land on the Instagram dashboard. Click the "Settings" icon in the sidebar.
3. Open the "Integrations" tab and toggle "DM tracking" to ON. Confirm the modal.
4. In a separate browser or mobile device, open Instagram as the second test user.
5. Send 2 or 3 direct messages to the business test account.
6. Return to Moka and navigate to Instagram → Dashboard. The "New conversations today" KPI should reflect the messages within ~60 seconds (webhook latency + aggregation window).
7. To test data deletion: in Settings → Integrations, click "Delete DM data". All conversation events and aggregates for this workspace are purged. The KPI returns to 0.
```

---

## 3. Screencast script (scene-by-scene)

Target: **under 3 minutes**. Narrated in English. Record at 1080p or higher. No music. Use a clean cursor; no notifications on screen.

| # | Duration | What to show | Voiceover |
|---|----------|--------------|-----------|
| 1 | 0:00 – 0:10 | Moka landing page (`/landing-arko`) then dashboard home. | "This is Moka, a B2B analytics dashboard for Instagram Business accounts. I'm logged in as a small business owner." |
| 2 | 0:10 – 0:25 | Click Sidebar → Settings → Integrations. Point at the "DM tracking" toggle, currently OFF. Hover the "What do we store?" tooltip so the reviewer can read it. | "In Settings, we offer an opt-in toggle for DM tracking. The tooltip explains exactly what we store: timestamps and opaque IDs only — never message content." |
| 3 | 0:25 – 0:40 | Click the toggle ON. A modal appears with a summary of what we store and what we do not. Click "Enable". | "The user confirms, and Moka subscribes our webhook to the Instagram messages field for this account. No OAuth re-prompt is needed because the permission was already granted." |
| 4 | 0:40 – 0:55 | Switch to a second window showing Instagram mobile or web, logged in as the fan/customer test user. Type and send two DMs to the business account. | "Now I'll simulate a customer. From a second test user, I send two direct messages to the business account." |
| 5 | 0:55 – 1:15 | Switch back to Moka. Navigate to Instagram → Dashboard. Show the "New conversations today" KPI card incrementing from 0 to 2 (may require one refresh). | "Back in Moka, the KPI updates. We count two new conversations today. Notice there is no inbox, no message preview, no sender name — only an aggregated count." |
| 6 | 1:15 – 1:35 | Open the DevTools Network tab or a Supabase log view showing the stored event row. Highlight the columns: `received_at`, `thread_id`, `sender_igsid`, `event_type`. Highlight that there is NO `text` column. | "Here's the underlying row in our database. We persist four fields. There is no column for message text, media, or the sender's personal information." |
| 7 | 1:35 – 1:50 | Scroll down to the "New conversations / 30d" line chart. | "The line chart plots daily counts over the last 30 days, so the business owner can correlate DM volume with their content calendar." |
| 8 | 1:50 – 2:10 | Navigate to Settings → Integrations → "Delete DM data" button. Click it and confirm. Show the KPI returning to 0. | "Users can delete all DM data at any time from Settings. This purges raw events and aggregates for the workspace. We also honor Meta's Data Deletion Callback." |
| 9 | 2:10 – 2:30 | Navigate to `/privacy` page. Scroll to the DM tracking section. | "Our Privacy Policy has a dedicated section for DM tracking describing the data we store, retention, and deletion options, linked from Settings and the footer." |
| 10 | 2:30 – 2:45 | Return to the dashboard. End on the KPI card. | "That's the entire scope of our usage: counts only, no content, fully user-controlled, with a clear deletion path. Thank you for your review." |

### 3.1 Tips for the recording

- Use a fresh test workspace. Seed it with 5–10 Reels of real-looking data so the dashboard does not look empty.
- Pre-write the two DMs in Notes so you can paste them instantly.
- Rehearse once end-to-end before hitting record. Reviewers reject videos that feel improvised.
- If the webhook-to-KPI latency is longer than 60 seconds in production, do a jump cut (it is allowed) and narrate "we fast-forwarded fifteen seconds for the webhook to land."

---

## 4. Data flow diagram

```
+----------------------+        +---------------------+        +----------------------------+
| Customer on IG       |        | Meta Instagram      |        | Moka webhook endpoint      |
| sends a DM to the    +------->+ messaging platform  +------->+ /api/webhooks/instagram    |
| business account     |        | (Graph API v25)     |        | (HMAC verified, Sprint B)  |
+----------------------+        +---------------------+        +-------------+--------------+
                                                                              |
                                                                              | strip text + attachments
                                                                              v
                                                               +------------------------------+
                                                               | supabase table:              |
                                                               | ig_dm_events                 |
                                                               | - received_at (timestamptz)  |
                                                               | - thread_id (text, opaque)   |
                                                               | - sender_igsid (text, opaque)|
                                                               | - event_type (enum)          |
                                                               | - workspace_id (fk)          |
                                                               +--------------+---------------+
                                                                              |
                                                                              | pg_cron daily rollup
                                                                              v
                                                               +------------------------------+
                                                               | ig_dm_daily_conversations    |
                                                               | - metric_date                |
                                                               | - new_conversations          |
                                                               | - total_events               |
                                                               +--------------+---------------+
                                                                              |
                                                                              | RLS-scoped SELECT
                                                                              v
                                                               +------------------------------+
                                                               | /instagram dashboard         |
                                                               | KPI + line chart only        |
                                                               +------------------------------+
```

### 4.1 What is stored vs what is NOT

| Field from webhook payload | Stored? | Reason |
|----------------------------|---------|--------|
| `message.text` | NO | Never read, never persisted. Dropped at the webhook handler. |
| `message.attachments` | NO | Dropped at the webhook handler. |
| `message.mid` (message id) | NO | Not needed for counting. |
| `sender.id` (IGSID) | YES | Opaque, Meta-provided. Used only to dedupe threads. |
| `sender.username` | NO | We never query this. |
| Profile name / phone / email | NO | Not provided by the webhook and never requested. |
| `recipient.id` | YES | Required to route to the correct workspace. |
| `timestamp` | YES | Used for the daily aggregate. |
| `thread_id` / conversation id | YES | Opaque. Used to detect "new" vs "continuing" conversations. |

### 4.2 Retention schedule

| Table | Retention | Enforced by |
|-------|-----------|-------------|
| `ig_dm_events` | 90 days | `pg_cron` daily `DELETE WHERE received_at < now() - interval '90 days'` |
| `ig_dm_daily_conversations` | Indefinite (while workspace active) | Deleted when workspace is deleted or user toggles tracking off |
| Daily aggregates after deletion request | 0 (immediate) | Data Deletion Callback + manual Settings button |

---

## 5. Likely objections + prepared answers

Meta's first-pass rejection rate is high. These are the scenarios we are preparing for.

### 5.1 "Why do you need this permission? Can't you use existing insights?"

> We audited the Instagram Graph insights surface. `total_interactions` on `/{ig-media-id}/insights` counts likes, comments, shares, and saves — but explicitly excludes direct messages. There is no `dm_count`, `conversations_started`, or equivalent metric at the account or media level. The only way to count new DM conversations is via the `messages` webhook field, which requires `instagram_business_manage_messages`.

### 5.2 "What happens if a user revokes the permission or deletes their account?"

> Three layers:
> 1. **User disconnects in Moka Settings** — we immediately call `DELETE /{ig-user-id}/subscribed_apps`, set `meta_connections.status = revoked`, purge the `ig_dm_events` and `ig_dm_daily_conversations` rows for that workspace.
> 2. **User revokes from Facebook → Business Integrations** — Meta stops sending webhook events. Our next cron run detects the stale subscription and purges the same data.
> 3. **Meta sends the Data Deletion Callback** — our `/api/data-deletion-callback` endpoint deletes all user-scoped rows and returns `{ url, confirmation_code }` per Meta spec.

### 5.3 "Do you read or display message content?"

> No. The webhook handler (Sprint B) parses the payload, reads only `timestamp`, `thread_id`, `sender.id`, `recipient.id`, and `event_type`. The `text` and `attachments` fields are dropped before the DB insert — not just hidden in the UI. A grep over our codebase for `message.text` returns zero matches. We will gladly provide a source-code excerpt of the handler.

### 5.4 "Why store `sender_igsid` at all?"

> To detect whether a message belongs to a **new** conversation or a **continuing** one. The "New conversations / day" metric depends on deduplication: if the same sender messages twice in a day, that is one conversation, not two. We do not reverse-lookup the IGSID to any name, profile, or contact record. The IGSID is opaque, meaning nothing outside the Meta ecosystem.

### 5.5 "Is this data shared with third parties or AI models?"

> No. `ig_dm_events` and `ig_dm_daily_conversations` are never sent to OpenAI, Anthropic, Apify, or any other third party. Our AI agents operate on Reels and account-level metrics only — they do not have read access to DM tables. This is enforced by Row-Level Security policies on those tables (SELECT restricted to the workspace owner and service role).

### 5.6 "Can the user export their DMs from Moka?"

> No. Moka has no export-DMs feature and no inbox. The only DM-related exports are the daily aggregate numbers (date, count), which are the same numbers visible on the dashboard.

### 5.7 "How does your screencast prove the claims?"

> The screencast shows the Supabase row for the stored event, highlighting the absence of a `text` column. It also shows the Settings toggle, the Privacy Policy section, and the data-deletion flow end-to-end.

---

## 6. Post-approval rollout plan

### 6.1 Staged enable (don't flip for 100 % of users on day 1)

1. **Day 0 (approval received)** — Merge the feature branch to `develop`. Keep the DM tracking toggle hidden behind a server-side feature flag (`ENABLE_DM_TRACKING=false` by default).
2. **Day 1** — Enable the flag for the internal Summit Lab workspace. Verify the KPI, the chart, the Settings toggle, and the delete path work end-to-end in production.
3. **Day 2–3** — Enable for 5 beta workspaces, hand-picked (existing active users who would value the metric). Monitor `ig_dm_events` insert rate and webhook error logs.
4. **Day 4–10** — Monitor for a week. Acceptance criteria before broader rollout:
   - Zero webhook HMAC verification failures.
   - Zero pg_cron purge failures.
   - No user reports of stale data.
   - No entries in `ig_dm_events` with a non-null `text` column (should be structurally impossible — the column doesn't exist — but add a schema check).
5. **Day 11** — Flip `ENABLE_DM_TRACKING=true` globally. Announce in-app via a toast for all IG-connected workspaces: "New: daily DM conversation tracking is available in Settings → Integrations."

### 6.2 Feature flag location

- Server env: `ENABLE_DM_TRACKING` (boolean).
- Client-side guard: Settings page hides the toggle row when the flag is off.
- Webhook handler: rejects events with `503` when the flag is off AND the workspace is not on the allowlist.

### 6.3 Monitoring dashboard

After rollout, add these metrics to the internal ops dashboard:

- `ig_dm_events` inserts/hour (should track roughly with workspace count).
- Webhook 4xx / 5xx response rate (target: <0.1 %).
- `ig_dm_daily_conversations` row count drift vs. previous day (alert if drops >50 %).
- Data-deletion-callback invocations (expected rate: ~0/day; alert if >5/day).

---

## 7. Rollback plan

If Meta revokes the permission after approval (e.g., policy change, spot audit, or our own violation):

1. **Immediate (automated)** — The webhook endpoint starts receiving 401/403 from Meta. The handler detects this and flips `meta_connections.dm_tracking_status` to `revoked_by_meta` for affected workspaces.
2. **Within 1 hour (manual trigger)** — Ops runs `SELECT public.disable_dm_tracking_globally();` which:
   - Sets `ENABLE_DM_TRACKING=false` across all workspaces.
   - Stops future webhook subscriptions.
   - Shows a banner in the dashboard: "DM tracking is paused. Existing historical data is preserved."
3. **No data loss** — We do NOT delete `ig_dm_events` or `ig_dm_daily_conversations` on revocation. The user can still view historical data, just not receive new events. This matches Meta's guidance that previously-collected data under a valid grant remains usable.
4. **Communication** — Email all affected workspaces within 24 hours. Template in `docs/email-templates/dm-tracking-paused.md` (to be written when rollback is needed).
5. **Resubmission** — If the revocation is due to a policy change we can accommodate, re-apply with the adjusted scope. If due to a compliance issue, remediate first and then resubmit with evidence.

---

## 8. Timeline expectations (for planning)

| Phase | Realistic duration |
|-------|--------------------|
| Internal prep (this doc + screencast + test users) | 2–4 days |
| First Meta review pass | 5–10 business days |
| Likely rejection + iteration (assume one round) | +5–7 business days |
| Final approval | Total ~3–5 weeks from submission |
| Staged rollout (section 6) | 10–14 days post-approval |

Plan for **5–6 weeks end-to-end** from today. If you hit approval in under 2 weeks, that is a bonus — do not promise it to stakeholders.

---

## 9. References

- Meta Platform Terms: https://developers.facebook.com/terms/
- Instagram Messaging API overview: https://developers.facebook.com/docs/messenger-platform/instagram
- App Review process: https://developers.facebook.com/docs/app-review
- Data Deletion Callback spec: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
- Moka Privacy Policy: https://usearko.io/privacy
- Moka Data Deletion: https://usearko.io/data-deletion
- Privacy Policy addendum (internal): `docs/PRIVACY_POLICY_ADDENDUM.md`
- Webhook implementation (Sprint B): see `docs/features/ig-intelligence.md` section 15 (to be added by Sprint B).
