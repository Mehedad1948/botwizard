## 1. Data model

- [x] 1.1 Prisma: `CampaignTarget`, `Delivery`, `BotConversation`; new campaign schedule/status fields; post media/entities/buttons; destination type/health; bot webhook id/secret
- [x] 1.2 SQL migration with data conversion and sibling merge
- [x] 1.3 Verify migration on a disposable Postgres seeded with legacy rows

## 2. Services

- [x] 2.1 `services/publishing/schedule.ts` (pure next-occurrence maths) + tests
- [x] 2.2 `services/publishing/errors.ts` (delivery error classification, Persian messages) + tests
- [x] 2.3 `services/publishing/content.ts` (send strategy, message capture) + tests
- [x] 2.4 `services/publishing/campaigns.ts` (owner-scoped create/update/pause/resume/delete/send-now)
- [x] 2.5 `services/publishing/scheduler.ts` (materialise occurrences, claim and send deliveries)
- [x] 2.6 `services/publishing/destinations.ts` (membership updates, health check)
- [x] 2.7 Subscriber notifications triggered once per occurrence

## 3. Entry points

- [x] 3.1 `POST /api/cron/tick` with `CRON_SECRET`, `maxDuration`
- [x] 3.2 `scripts/scheduler.mjs` loop for dev/VPS, cron-job.org setup script (`npm run cron:setup`)
- [x] 3.3 `/api/bots/hook/[webhookId]` with secret verification; legacy routes delegate
- [x] 3.4 Repair-connection action (re-register webhook, show webhook info)

## 4. Owner bot conversation

- [x] 4.1 Conversation state store and callback router
- [x] 4.2 Capture → send now / schedule (presets) → pick destinations → confirm
- [x] 4.3 Campaign list (pause/resume/delete/run now) and destination list, bot-scoped

## 5. Dashboard

- [x] 5.1 Composer (text, media upload, URL buttons) and post library
- [x] 5.2 Campaign wizard (destinations, schedule, options) with human summary
- [x] 5.3 Campaign list/detail with delivery log, upcoming runs, actions
- [x] 5.4 Bot workspace: destination health, connection status

## 6. Verification

- [x] 6.1 `tsc`, lint, vitest green
- [x] 6.2 Scheduler exercised against a disposable Postgres with a fake provider
- [x] 6.3 Update `PROJECT_CONTEXT.md`, `.env.example`

## 7. Remaining before archive

- [ ] 7.1 Apply both new migrations to staging, then production (user action)
- [ ] 7.2 Configure `CRON_SECRET` and a per-minute caller of `/api/cron/tick`
- [ ] 7.3 Press "اتصال دوباره" for existing bots to move them to opaque webhook URLs
- [ ] 7.4 Click-through test of dashboard wizard, composer upload and owner bot menus on a real bot
