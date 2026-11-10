## Context

See `docs/REFACTOR_PLAN.md` §0–1 for the product review and diagnosis. Hosting
is a serverless Next.js deployment plus PostgreSQL, so the scheduler must be a
stateless, idempotent HTTP tick that a platform cron (or a small loop script)
calls every minute.

## Decisions

### Delivery rows are the queue

No generic job table yet. A due campaign occurrence is *materialised* into one
`Delivery` row per target (`@@unique([campaignId, chatId, occurrenceKey])`),
with `runAt = occurrence + random(0..jitter)`. Workers claim rows with
`FOR UPDATE SKIP LOCKED`, set `SENDING` + `lockedAt`, and finish them as
`SENT`, `FAILED` (terminal / attempts exhausted) or back to `PENDING` with
backoff. `SENDING` rows older than the lease are reclaimed. A generic job table
arrives with the flow engine (it needs delayed resumes).

### Materialisation is transactional and skips missed runs

Due campaigns are locked with `FOR UPDATE SKIP LOCKED`; the occurrence key is
`s:<nextRun ISO>`. The next run is computed **after `max(now, occurrence)`**, so
an outage produces one catch-up send, not a burst.

### Schedule maths is pure

`nextOccurrence(rule, after)` lives in `services/publishing/schedule.ts`, works
for any IANA timezone via `Intl`, and is unit-tested. Weekdays use JavaScript
numbering (0 = Sunday); the UI renders a Saturday-first Persian week.

### Content send strategy

1. `mediaFileId` or stored `entities` present → send from stored data
   (`sendPhoto`/`sendVideo`/…/`sendMessage`) with URL buttons.
2. Otherwise legacy post with source IDs → `copyMessage`; if the source message
   is gone and text exists, fall back to `sendMessage`.
3. Otherwise `sendMessage` with text.

Bale receives the same calls without `entities`/`caption_entities`.

### Error classification

`classifyDeliveryError` maps provider descriptions to `NO_PERMISSION`,
`REMOVED`, `BLOCKED`, `RATE_LIMITED`, `TRANSIENT`, `CONTENT_MISSING`,
`TERMINAL`, each with a Persian, actionable message. `NO_PERMISSION`/`REMOVED`
update the destination's health.

### Owner conversation state

`BotConversation` rows (opaque id, bot, chat, kind, JSON data, expiry 1 day)
hold multi-step state. Callback data is `<action>:<conversationId>[:<arg>]`,
always under 64 bytes. Every handler re-checks bot scope.

### Webhook URL

`Bot.webhookId` (random, unique) and `Bot.webhookSecret`. New route
`/api/bots/hook/[webhookId]` verifies `X-Telegram-Bot-Api-Secret-Token` for
Telegram bots that have a secret. Existing bots are moved by the dashboard
"repair connection" action.

## Migration

One SQL migration: add new columns/tables, convert schedules
(`INTERVAL` hours → minutes, `SPECIFIC_TIMES` → `DAILY`), map `isActive` to
status, create targets from `chatId` (creating a `ConnectedChat` if missing),
merge rows sharing `subscriberAudienceKey`, copy `PostHistory` to `Delivery`,
then drop old columns and `PostHistory`. Verified on a disposable Postgres
before the user applies it.

## Risks

- Vercel Hobby cron runs only daily → cron-job.org calls the tick every
  minute (`scripts/setup-cron-job.mjs`); it aborts after 30s, so a tick stops
  after ~22s and leaves the rest to the next minute.
- Server Action uploads are limited to 4.5 MB on Vercel → large media should be
  sent through the bot.
