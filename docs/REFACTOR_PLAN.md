# BotWizard Refactor & Rebuild Plan

Status: proposed · Created: 2026-11-09 · Owner: Mehrdad

This plan turns BotWizard from a set of partially-working features into a
product a non-technical Telegram/Bale admin can use end to end: connect a bot,
publish and schedule content reliably, and finally **design the bot's behaviour
visually with a block-based flow builder** (n8n / ManyChat style).

How to use this document:

- Work the phases **in order**. Each phase ships something usable on its own and
  is the foundation for the next. Do not start the flow builder (Phase 5–6)
  before delivery (Phase 1) is reliable — the builder reuses that engine.
- Each phase maps to one or more **OpenSpec changes** (names suggested below).
  Create the proposal under `openspec/changes/` before implementing, per
  `AGENTS.md`.
- Each phase has **acceptance criteria written as user outcomes**. A phase is
  done when a real user can do those things on a deployed environment, not when
  the code compiles.
- Update `PROJECT_CONTEXT.md` at the end of every phase.

---

## 0. Product review and decisions (2026-11-09)

The question is not only "do the features work" but "would anyone keep using
them". Conclusions:

1. **Who it is for.** Persian-speaking owners of Telegram/Bale *channels and
   groups they run* (shops, teachers, media pages, communities) and small
   businesses that need a customer-facing bot but cannot code.
2. **What is actually valuable.**
   - A reliable **content calendar** for their own channels: one post, many
     destinations, once / daily / weekly / every N hours, with proof of
     delivery. Telegram's native scheduling is one-shot and per chat; Bale has
     almost nothing. Bale support is a real differentiator in the Iranian market.
   - A **no-code customer bot** (menu, FAQ, order/lead form, support relay,
     topic newsletter) built from templates and edited visually.
3. **What we de-emphasise.** "Repost an ad into many groups every 2 hours"
   (the original *autopromo* idea). It gets bots kicked and accounts
   rate-limited, and is not a durable product. Guardrails: minimum interval 1h,
   destinations must be added by the owner, jitter supported.
4. **Consequences for the build order.**
   - Publishing model reshape and scheduler are **one change**
     (`rebuild-publishing-engine`), otherwise the scheduler is written twice.
   - The owner admin menu moves behind `/admin`; plain private messages from
     the owner stop becoming drafts once flows exist, because the bot's private
     chat becomes the *customer-facing* surface.
   - The dashboard stays split by platform for now (cheap, already built).
     Cross-posting the same content to Telegram **and** Bale is a later phase
     (needs media re-upload across bots); the content model is kept portable.

---

## 1. Diagnosis: why the product is not usable today

### 1.1 The core promise does not work

| Problem | Evidence | User impact |
|---|---|---|
| No scheduler | Nothing reads `Campaign.nextRun`; no cron/queue/worker exists | "Scheduled" campaigns never send. The main feature is fake. |
| Delivery depends on the owner's private message | `copyMessage` from `Post.sourceChatId/sourceMessageId` | If the owner deletes the draft message in their bot chat, every campaign using it breaks silently. |
| `randomDelay` is stored but never used | `schema.prisma` | Toggle that does nothing. |

### 1.2 Confirmed bugs in the bot conversation (`lib/telegram/handlers/callback.ts`)

1. **Prefix collision** — `data.startsWith("tgl_")` (chat-selection toggle) is
   checked before `tgl_camp_`, so *pause/resume campaign from the bot never
   works*; it only flips a button label.
2. **Missing ownership scope** — `del_camp_`, `tgl_camp_` and `view_post_` load
   by bare ID with no `botId` filter. A crafted callback (possible from MTProto
   clients) can act on another tenant's campaign/post.
3. **Wrong post binding** — interval and specific-time campaign creation use
   "latest post of this bot" instead of the selected draft (`draft.ts`,
   `callback.ts` step 7). Two drafts in a row → the wrong post is scheduled.
4. **State in callback data** — chat IDs are joined into `callback_data` and
   `.substring(0, 64)` truncated. With 3+ groups, IDs are silently cut and
   campaigns target wrong/invalid chats. Specific-times state is hidden in a
   `#SchData_` hashtag inside message text.
5. **Raw error leakage** — `draft.ts` sends `error.message` to the user (TODO
   left in code).
6. **Every private owner message becomes a draft** — makes it impossible to
   later give the bot any other conversational behaviour.

### 1.3 Model and UX problems

- **Campaign = 1 post × 1 chat.** Publishing one post to 5 groups creates 5
  campaigns; lists explode, editing a schedule means editing 5 rows.
  `subscriberAudienceKey` is a workaround for this.
- **Content can only be created inside the bot chat.** The dashboard has no
  composer; `/posts` just redirects; `createPostAction` has no UI.
- **Inconsistent rules.** Bot offers 2/12/24h intervals, dashboard allows ≥2h,
  schema comment says min 24h. Timezone hard-coded to `Asia/Tehran`.
- **No onboarding.** After login the user sees three counters at zero and must
  figure out BotFather, webhook, admin rights, pairing (Bale) by themselves.
- **No destination health.** We never check whether the bot can still post in a
  chat (admin rights revoked, kicked) until a send fails.
- **Telegram vs Bale asymmetry.** Telegram bots register via the main bot chat;
  Bale bots via dashboard + `/connect CODE`. Two mental models.
- **Duplicated code paths.** Immediate send is implemented twice in
  `callback.ts`, again in dashboard actions; `callTelegramAPI` and the provider
  abstraction coexist.

### 1.4 Security / ops gaps (from `PROJECT_CONTEXT.md`, still open)

- Bot tokens stored plaintext and embedded in webhook URLs; no
  `secret_token` header verification.
- Stateless sessions, no revocation.
- No CI, almost no tests (only audience-notification unit tests).
- `debug.log` is tracked in git; legacy unscoped dashboard routes and the legacy
  `/api/telegram/webhook/[token]` dispatcher still exist.

---

## 2. Target product

Three pillars, shown as the three main sections of the dashboard:

1. **Connect** — bots and their destinations (groups/channels), with health status.
2. **Publish** — a content library and campaigns (one-off or recurring posts to
   many destinations), with a queue/calendar and a delivery log.
3. **Automate** — a visual flow builder that defines how the bot talks to users
   (welcome, menus, forms, FAQs, support relay, topic subscriptions), started
   from templates ("scaffold my bot").

Plus cross-cutting: **Audience** (subscribers, topics, collected data) and
**Activity** (everything the bot did, with errors explained in plain Persian).

### Core user journeys (must be smooth by the end)

- **J1 First run (≤ 5 min):** log in → guided wizard → paste token → bot
  verified → "add bot to your channel as admin" with live detection → send a
  test post → done.
- **J2 Publish:** compose a post in the dashboard (text, media, buttons) or
  forward it to the bot → choose destinations → send now / once later /
  recurring → see it in the queue → see delivery results.
- **J3 Automate:** pick a template (e.g. "Lead capture") → answer 3 questions →
  a flow is generated → tweak blocks on the canvas → test in a simulator →
  publish → real users interact with the bot.
- **J4 Operate:** see what failed and why, fix (e.g. "bot lost admin rights in
  X"), retry.

---

## 3. Guiding principles

1. **One engine, many surfaces.** Scheduling, delivery, retries and logs live in
   one service layer. Dashboard actions, bot admin menus and flow nodes all call
   it. No feature talks to the Bot API directly.
2. **State lives in the database, never in callback data.** Callback data
   carries only a short opaque key (`a:<id>`), resolved server-side with
   ownership checks.
3. **Every mutation is scoped by owner** (`userId` → `botId`), in services, not
   only in pages.
4. **Platform differences live in the provider + a capability matrix.** UI
   hides/disables what a platform cannot do.
5. **Dashboard first, bot chat second.** The bot admin menu becomes a quick
   companion (capture a post, pause, see status), not the primary UI.
6. **Explain failures.** Every provider error is classified and mapped to a
   Persian, actionable message.
7. **Ship vertical slices.** Each phase ends deployed and usable.

---

## 4. Target architecture

```text
app/ (UI + route handlers, thin)
  (dashboard)/dashboard/[platform]/
     connect/   publish/   automate/   audience/   activity/
  api/
     bots/webhook/[platform]/[webhookId]   ← no token in URL
     cron/tick                             ← scheduler entry (secret protected)

services/ (domain, no React, fully testable)
  bot-platforms/     provider, capabilities, webhook registration, secrets
  bots/              connect/verify/pair/disconnect, health checks
  destinations/      discovery, permission checks, status
  content/           content library, media ingestion (file_id), rendering
  campaigns/         CRUD, schedule rules → next occurrence
  scheduler/         job table, claim/lease, tick
  delivery/          send to chat / subscriber, rate limits, retries, Delivery log
  conversations/     short-lived conversation state (replaces callback state)
  audience/          subscribers, topics, collected data   (existing audience-notifications)
  flows/             graph schema, validation, compiler, runtime, node registry
  i18n/              Persian copy + error message mapping

lib/  prisma, session, auth, utils (infrastructure only)
```

Update routing order (single dispatcher in `services/bot-platforms/dispatch-update.ts`):

```text
incoming update
  → verify secret header, load bot by webhookId
  → membership updates (bot added/removed) → destinations
  → owner admin commands (/admin, /post, reserved callbacks)  [owner only]
  → active flow run waiting for this user's input → resume run
  → flow trigger match (command / keyword / start param / button)
  → built-in fallback (default welcome / topic preferences)
```

---

## 5. Target data model (sketch)

Introduced across Phases 1–2 and 5. Names are proposals; refine in OpenSpec design docs.

```prisma
// Phase 1 — execution
model Job {
  id         String    @id @default(cuid())
  type       String    // "campaign.occurrence", "flow.resume", "destination.check", ...
  payload    Json
  runAt      DateTime
  status     JobStatus @default(PENDING)  // PENDING RUNNING DONE FAILED CANCELLED
  attempts   Int       @default(0)
  lockedAt   DateTime?
  lockedBy   String?
  lastError  String?
  dedupeKey  String?   @unique
  @@index([status, runAt])
}

model Delivery {   // replaces PostHistory; generalises SubscriberNotificationDispatch later
  id                String   @id @default(cuid())
  botId             String
  campaignId        String?
  flowRunId         String?
  destinationId     String?
  subscriberId      String?
  occurrenceKey     String
  status            DeliveryStatus // PENDING SENT FAILED SKIPPED
  errorKind         String?        // BLOCKED RATE_LIMITED NO_PERMISSION ...
  errorMessage      String?
  providerMessageId String?
  attemptedAt       DateTime?
  sentAt            DateTime?
  @@unique([campaignId, destinationId, occurrenceKey])
}

// Phase 2 — publishing domain
model Content {          // evolves Post
  id, botId, title?
  kind        ContentKind  // TEXT PHOTO VIDEO DOCUMENT ANIMATION AUDIO ALBUM
  text        String?
  entities    Json?        // keep formatting without depending on the source message
  media       Json?        // [{ type, fileId, fileUniqueId }]
  buttons     Json?        // URL buttons
  sourceChatId, sourceMessageId   // kept for provenance only
  archivedAt  DateTime?
}

model Destination {      // evolves ConnectedChat
  id, botId, chatId, title
  type        ChatType     // GROUP SUPERGROUP CHANNEL
  status      DestinationStatus // OK NO_PERMISSION REMOVED UNKNOWN
  canPost     Boolean
  lastCheckedAt DateTime?
  @@unique([botId, chatId])
}

model Campaign {         // one campaign → many destinations
  id, botId, name, contentId
  status        CampaignStatus // DRAFT SCHEDULED ACTIVE PAUSED COMPLETED
  scheduleKind  ScheduleKind   // NOW ONCE INTERVAL DAILY WEEKLY
  schedule      Json           // { at } | { everyMinutes } | { times[] } | { days[], times[] }
  timezone      String  @default("Asia/Tehran")
  jitterMinutes Int     @default(0)
  startsAt, endsAt, maxRuns, runCount
  nextRunAt     DateTime?
  notifySubscribers Boolean @default(false)
  targets       CampaignTarget[]
}

model CampaignTarget { campaignId, destinationId  @@id([campaignId, destinationId]) }

// Phase 4 — conversations
model ConversationState {
  id        String   @id          // short opaque id used in callback_data
  botId, chatId, platformUserId
  kind      String               // "publish.pickDestinations", ...
  data      Json
  expiresAt DateTime
}

// Phase 5 — flows
model Flow        { id, botId, name, status (DRAFT/ACTIVE/PAUSED), activeVersionId?, templateKey? }
model FlowVersion { id, flowId, version, graph Json, createdAt, publishedAt? }
model FlowTrigger { id, botId, flowVersionId, type, key, priority }   // denormalised index for fast routing
model FlowRun     { id, flowVersionId, botId, subscriberId?, chatId,
                    status (RUNNING WAITING DONE FAILED CANCELLED),
                    currentNodeId?, vars Json, waitingFor Json?, resumeAt?, stepCount }
model FlowRunStep { id, runId, nodeId, status, input Json?, output Json?, error?, at }
model CollectedRecord { id, botId, flowId, subscriberId?, data Json, createdAt }   // form answers
```

**Data migration:** group existing `Campaign` rows by `subscriberAudienceKey`
(fallback: `postId + scheduleType + intervalHours/specificTimes + createdAt`
within 1 minute) into one `Campaign` with N `CampaignTarget`s. Copy
`PostHistory` into `Delivery`. `Post` → `Content` (text only; media `fileId`s are
backfilled when the owner next interacts, or the campaign keeps `copyMessage`
provenance as fallback). Write the migration as a script with a dry-run mode
and run it against a copy of production first.

---

## 6. Phases

Sizes: S ≈ few days, M ≈ 1–2 weeks, L ≈ 3+ weeks (one developer + agent).

### Phase 0 — Stabilise and clean the ground (S)

OpenSpec: `fix-bot-callback-safety`, `chore-repo-hygiene`

- [ ] Fix the `tgl_` / `tgl_camp_` collision (order checks, or switch to exact
      action parsing).
- [ ] Scope `del_camp_`, `tgl_camp_`, `view_post_`, `leave_chat_` by `bot.id`.
- [ ] Bind campaigns to the selected draft ID, not the latest post.
- [ ] Remove raw error text from bot replies; log server-side.
- [ ] Add Telegram `secret_token` to `setWebhook` and verify
      `X-Telegram-Bot-Api-Secret-Token` (check Bale support; if absent, rely on the
      opaque webhook ID from Phase 1).
- [ ] Unify interval rules in one constant (`services/campaigns/rules.ts`).
- [ ] Remove `debug.log` from git, fix `components.json` CSS path, delete the
      unused posts `console.log`.
- [ ] Add CI (GitHub Actions): `lint`, `tsc --noEmit`, `vitest`. No `build` in
      CI (it runs `migrate deploy`).
- [ ] Add a Vitest setup for a throwaway Postgres (Docker or Neon branch) for
      integration tests.

Acceptance: pausing/deleting a campaign from the bot works; a callback for a
foreign campaign ID is rejected; CI is green on every push.

### Phase 1 — Make delivery real: scheduler, jobs, delivery log (M)

OpenSpec: `add-delivery-engine`

- [ ] `Job` table + `services/scheduler`: `enqueue`, `claimDue(limit)` using
      `SELECT … FOR UPDATE SKIP LOCKED`, lease/timeout, retries with backoff,
      dedupe key.
- [ ] `POST /api/cron/tick` protected by `CRON_SECRET`; processes due jobs within
      a time budget and returns. Triggered every minute by the hosting cron
      (see Open decisions §8) — the endpoint must be idempotent and safe to
      call concurrently.
- [ ] `services/delivery`: one `sendToDestination` and one `sendToSubscriber`
      used by everything; per-chat and global rate limiting (Telegram ≈ 30
      msg/s global, ≈ 20 msg/min per group); classify errors (existing
      `ProviderErrorKind` + `NO_PERMISSION`, `CHAT_NOT_FOUND`).
- [ ] Campaign occurrence handler: compute occurrence key, send to target,
      write `Delivery`, compute and store next run atomically, apply jitter.
- [ ] Move all immediate-send code paths (bot + dashboard) onto the delivery
      service. Delete the duplicates in `callback.ts`.
- [ ] Mark destination `NO_PERMISSION`/`REMOVED` automatically on matching
      errors; pause affected campaigns targets and notify the owner in the bot.
- [ ] Replace `PostHistory` writes with `Delivery`.

Acceptance: a campaign scheduled for "every 2 hours" and one for "daily 09:00,
18:30" actually post on time on the deployed environment for 48h; failures show
a reason in the dashboard; running the tick twice concurrently never double-posts.

### Phase 2 — Reshape the publishing domain (M–L)

OpenSpec: `reshape-publishing-model`

- [ ] Prisma: `Content`, `Destination`, `Campaign` (multi-target),
      `CampaignTarget`; migration + data migration script (see §5).
- [ ] Media ingestion: when the owner sends media to the bot, store `file_id`s,
      caption entities and kind on `Content`. Delivery uses `sendPhoto` /
      `sendVideo` / `sendMediaGroup` from stored data; `copyMessage` only as
      fallback for legacy rows.
- [ ] Dashboard upload: the server sends the uploaded file once to the owner's
      private chat (or a configured storage chat) to obtain a `file_id`, then
      deletes the helper message. No external object storage needed initially.
- [ ] Schedule rules: `NOW`, `ONCE(at)`, `INTERVAL(everyMinutes ≥ 60)`,
      `DAILY(times[])`, `WEEKLY(days[], times[])`, optional `endsAt`/`maxRuns`,
      per-campaign timezone (default from user profile). One pure function
      `nextOccurrence(rule, after)` with exhaustive unit tests (DST-free zones and
      DST zones).
- [ ] Destination health check job: `getChatMember(bot)` on add and daily.
- [ ] Unify bot onboarding for both platforms in the dashboard: paste token →
      `getMe` → register webhook (opaque `webhookId`, token not in URL) → owner
      pairing via deep link `t.me/<bot>?start=pair_<code>` (Telegram can also
      auto-pair via linked Telegram ID). Keep main-bot token flow as a shortcut.
- [ ] Encrypt bot tokens at rest (AES-GCM with `BOT_TOKEN_ENC_KEY`), migrate
      existing tokens, re-register webhooks to the new URL.

Acceptance: one campaign targets 5 channels and is edited in one place; a
photo post created in the dashboard is delivered with formatting intact even
after the owner deleted their chat history; Bale and Telegram bots connect with
the same dashboard steps.

### Phase 3 — Dashboard UX rebuild (L)

OpenSpec: `rebuild-dashboard-ux`

Navigation: **خانه · اتصال · انتشار · اتوماسیون · مخاطبان · فعالیت**
(Home · Connect · Publish · Automate · Audience · Activity), all scoped to a
selected bot (bot switcher in the header next to the platform switcher).

- [ ] **Setup checklist on Home** — persistent until done: connect bot → pair
      owner → add a destination (live polling shows "detected ✓ / missing post
      permission ✗") → send test post → create first campaign. Replaces the
      three zero counters.
- [ ] **Composer** (Publish → New): text editor with Telegram-compatible
      formatting (bold/italic/link/spoiler), media upload, URL buttons, live
      phone-style preview (RTL), "send preview to me" button.
- [ ] **Campaign wizard**: Content → Destinations (multi-select with health
      badges) → When (Now / Once / Repeat with human summary: «هر روز ساعت ۹:۰۰ و
      ۱۸:۳۰ به وقت تهران») → Options (jitter, notify subscribers) → Review.
- [ ] **Queue & calendar**: upcoming occurrences (next 7 days) across campaigns,
      pause/skip-one/run-now.
- [ ] **Activity**: unified Delivery + bot events feed with filters and
      human-readable error explanations and fix links ("give admin rights in X").
- [ ] Empty states that teach, loading skeletons, optimistic toggles, toasts,
      confirm dialogs for destructive actions (reuse `ConfirmedActionButton`).
- [ ] Mobile-first layouts (most admins use phones); verify at 360px width.
- [ ] Centralise Persian copy in `services/i18n/fa.ts`; Persian digits and
      Jalali dates in display (`Intl` with `fa-IR-u-ca-persian`).
- [ ] Remove legacy unscoped routes and the posts redirect.

Acceptance: a new user who has never seen the app completes J1 and J2 without
help (do 3 hallway tests and fix what they stumble on).

### Phase 4 — Bot conversation rebuild (owner side) (M)

OpenSpec: `rebuild-owner-bot-menu`

- [ ] `ConversationState` store; callback format `v1:<action>:<stateId>`
      (always < 64 bytes); expiry + "this menu expired, /admin" message.
- [ ] Owner admin entry is explicit: `/admin` (and `/start` for the owner shows
      the admin menu). **Plain private messages are no longer auto-drafts**;
      capture happens via «📝 پست جدید» → "send your content now" → state
      waits for the next message, or by forwarding with `/post`.
- [ ] Menus: New post → destinations (paginated toggle list stored in state)
      → now / schedule (presets + "open in dashboard" deep link for advanced) ·
      Campaigns (paginated, pause/resume/delete/run now) · Destinations
      (health, leave) · Status (next runs, last failures) · Open dashboard (one-
      time login link).
- [ ] All actions call the same services as the dashboard.
- [ ] Router table instead of `if (data.startsWith…)` chains:
      `registerCallback("campaign.pause", handler)`.

Acceptance: scheduling a post to 10 groups from the bot works; old menus fail
gracefully; non-owner users never see admin menus (now handled by flows / fallback).

### Phase 5 — Flow engine (runtime, no visual editor yet) (L)

OpenSpec: `add-flow-engine`

Build the engine headless first, driven by JSON graphs and tests. This is the
part that decides whether the builder is real or a toy.

**Graph format** (validated with zod, stored in `FlowVersion.graph`):

```json
{
  "schema": 1,
  "nodes": [
    { "id": "n1", "type": "trigger.command", "config": { "command": "start" } },
    { "id": "n2", "type": "message.send", "config": { "text": "سلام {{user.firstName}}!", "buttons": [] } },
    { "id": "n3", "type": "message.menu", "config": { "text": "چه کاری انجام دهم؟",
        "options": [{ "id": "o1", "label": "قیمت‌ها" }, { "id": "o2", "label": "پشتیبانی" }] } }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" },
    { "from": "n3", "fromPort": "o1", "to": "n4" }
  ]
}
```

**Node catalog v1** (each node = `{ type, configSchema, ports, capabilities, execute() }`
in `services/flows/nodes/*`):

| Group | Nodes |
|---|---|
| Triggers | Command (`/x`), Start with parameter (deep link), Keyword/regex, Any message, Button from another flow, Schedule (uses Phase 1 jobs), Bot added to chat, New subscriber |
| Messages | Send message (text/media/URL buttons), Send saved content, Menu (inline options → one output port each), Ask question (wait for reply; validators: text, number, phone, email, choice, media) |
| Logic | Condition (if/else on variables), Switch, Random split (A/B), Wait (delay), Go to flow, End |
| Data | Set variable, Save to collected data, Subscribe/unsubscribe topic, Tag subscriber |
| Actions | Notify owner/admin chat, Forward to group (support relay), Publish to destinations, HTTP request (later, behind a flag) |

**Runtime semantics:**

- A run is per (bot, user/chat, flow version). Webhook → router finds a waiting
  run for this user or a matching trigger → executes nodes synchronously until
  it hits a *waiting* node (Ask, Menu, Wait) or ends.
- Waiting runs persist `currentNodeId`, `vars`, `waitingFor` and optional
  `resumeAt` (Wait/timeouts become `flow.resume` jobs from Phase 1).
- Menu button callbacks: `v1:f:<runId-short>:<portId>` resolved and checked
  against the run's bot and user.
- Templating: `{{user.firstName}}`, `{{vars.email}}`, `{{bot.username}}` —
  string interpolation only, no code execution. Escape for the parse mode.
- Guards: max 50 steps per activation, loop detection, max 1 active run per user
  per flow (new trigger cancels or is ignored — configurable), run TTL.
- HTTP node (later): timeout, response size limit, block private/loopback IPs
  (SSRF), secrets stored per bot, never shown back in the UI.
- Published versions are immutable; running runs keep their version.
- Every step writes `FlowRunStep` → powers debugging and the Activity feed.
- Platform capability matrix per node (e.g. some formatting/keyboards differ on
  Bale); validation rejects unsupported nodes for the bot's platform.
- Fold existing subscriber topic commands (`/topics`, `/stop`) into built-in
  nodes/flows so there is one routing mechanism.

**Testing:** a fake provider that records outgoing calls; table tests that feed
updates into the engine and assert messages + state. Target: every node type
covered, plus resume-after-wait and expired-menu cases.

Acceptance: a JSON-defined "welcome + menu + lead form" flow runs on a real bot,
collected answers appear in the dashboard (Audience → Collected data, CSV
export), and a 1-hour Wait node resumes correctly via the scheduler.

### Phase 6 — Visual flow builder and bot scaffolding (L)

OpenSpec: `add-flow-builder`, `add-flow-templates`

- [ ] Canvas using **@xyflow/react** (React Flow, MIT): drag nodes from a
      palette, connect ports, pan/zoom, minimap, auto-layout (elkjs/dagre), RTL
      labels inside nodes, LTR canvas coordinates.
- [ ] Side **inspector** generated from each node's zod config schema
      (shared between engine and UI), with Persian labels and help text.
- [ ] **Live validation**: unreachable nodes, missing required config, ports not
      connected, unsupported-on-platform nodes, duplicate trigger commands
      across active flows. Publish is blocked until valid.
- [ ] **Simulator panel**: a phone-like chat that runs the draft graph against
      the real engine with a fake provider; highlights the active node.
- [ ] Draft autosave, versions list, publish / rollback, pause flow.
- [ ] Per-flow stats on nodes (runs, drop-off, errors) from `FlowRunStep`.
- [ ] **Scaffold wizard ("ساخت ربات با قالب")** — the n8n-like starting point:
      choose a template → answer 2–4 questions (business name, menu items,
      fields to collect, admin chat) → generate a ready graph → open in canvas.
      Templates v1:
  1. Welcome + main menu
  2. FAQ bot (question → answer buttons)
  3. Lead / order form (Ask nodes → collected data → notify owner)
  4. Support relay (user message → admin group; admin reply → user)
  5. Newsletter with topics (wraps existing audience topics)
  6. Channel auto-poster (Schedule trigger → Publish content to destinations)
- [ ] Mobile: builder is desktop-first; on phones show read-only flow + list
      editor for simple edits (text of messages, menu options).

Acceptance: a user builds a lead-capture bot from a template in under 10
minutes, tests it in the simulator, publishes, and receives a real lead in
their Telegram as a notification.

### Phase 7 — Production hardening & launch (M)

OpenSpec: `harden-for-launch`

- [ ] Observability: structured logs with request/run IDs, error tracking
      (e.g. Sentry), dashboard of job lag and failure rates.
- [ ] Session revocation (session table or version counter on `User`), logout
      everywhere.
- [ ] Plan limits per user (bots, active flows, messages/day) even if billing
      comes later — prevents abuse and protects bot tokens from bans.
- [ ] Data retention jobs (`Delivery`, `FlowRunStep`, `LoginToken`).
- [ ] Backup/restore runbook; staging environment with its own bots.
- [ ] Rewrite `README.md` as a real project guide; update landing page copy to
      match real features; add `/policy` page (currently a dead link).

Acceptance: 2 weeks of real users on staging-then-prod with no lost or duplicate
deliveries, and every failure visible in Activity.

---

## 7. Cross-phase checklist for every change

- OpenSpec proposal + spec delta written and reviewed before code.
- Read the relevant `node_modules/next/dist/docs/` guide before touching Next.js
  APIs (e.g. `after()`, route handlers, Server Actions).
- Services have unit tests; DB-touching services have integration tests.
- No direct Bot API calls outside `services/bot-platforms` / `services/delivery`.
- Ownership enforced in the service function signature (`ownerUserId` param).
- Persian copy added to `services/i18n/fa.ts`, not inline.
- Migrations are additive first; destructive cleanup in a later release.
- `PROJECT_CONTEXT.md` updated.

---

## 8. Open decisions (resolve before the phase that needs them)

| # | Decision | Needed by | Recommendation |
|---|---|---|---|
| D1 | Hosting & cron trigger | Phase 1 | **Decided:** Next.js on Vercel; cron-job.org calls `/api/cron/tick` every minute (`npm run cron:setup`). |
| D2 | Bale API reachability from the host | Phase 1 | Measure from the chosen host; the existing `V2RAY_PROXY` hints at network constraints. |
| D3 | Keep `copyMessage` fallback forever? | Phase 2 | Keep for legacy rows only; new content uses stored `file_id`s. |
| D4 | Main Telegram bot role | Phase 2 | Keep for login + quick token connect; dashboard is the primary onboarding. |
| D5 | Should campaigns become flows internally? | Phase 5 | No for v1. Campaigns stay a first-class, simple product; the "Channel auto-poster" template creates a campaign under the hood. Share the delivery engine, not the model. |
| D6 | HTTP request node | Phase 6+ | Ship behind a feature flag after SSRF guards and per-bot secrets exist. |
| D7 | Per-user timezone | Phase 2 | Add `User.timezone` default `Asia/Tehran`; campaign inherits, can override. |
| D8 | Billing | Phase 7 | Limits first, billing later. |

---

## 9. Suggested order of OpenSpec changes

1. `fix-bot-callback-safety`
2. `chore-repo-hygiene` (CI, tests infra, cleanup)
3. `add-delivery-engine`
4. `reshape-publishing-model`
5. `rebuild-dashboard-ux`
6. `rebuild-owner-bot-menu`
7. `add-flow-engine`
8. `add-flow-builder`
9. `add-flow-templates`
10. `harden-for-launch`

Also: finish and archive the open `add-subscriber-notification-preferences`
change (task 1.8, test sections 9.1–9.12 and manual rollout 10.4–10.8 remain;
9.1's test harness overlaps Phase 0) before starting step 3, since Phase 1
replaces its dispatch path with the shared delivery engine.

---

## 10. Progress log

### 2026-11-10 — Step 1: publishing engine (`rebuild-publishing-engine`)

Done (covers plan Phases 0, 1, 2 and most of 3–4 for publishing):

- Multi-destination campaigns, ONCE/INTERVAL/DAILY/WEEKLY schedules with
  timezone, end date, max runs and jitter; working scheduler (`/api/cron/tick`,
  cron-job.org via `npm run cron:setup`, `npm run scheduler`) with exactly-once delivery per
  destination and run, retries, and Persian failure explanations.
- Posts store media `file_id`, entities and URL buttons; dashboard composer
  with media upload; post library with archive and preview-in-bot.
- Destination health from membership updates, delivery errors and an
  on-demand check; owner notified in the bot.
- Opaque webhook URLs with Telegram secret verification; "repair connection".
- Owner bot rebuilt: server-side state, all callbacks bot-scoped, paginated
  destination picker, daily/interval/once scheduling, campaign and
  destination management, status screen. Fixed: prefix collision, unscoped
  IDs, wrong-post binding, callback truncation, raw error leakage.
- Dashboard rebuilt: onboarding home, bot setup checklist, posts, campaign
  wizard, campaign detail with per-run delivery log.
- Migrations: idempotent drift reconcile + data-converting rebuild, verified on
  a disposable Postgres with legacy rows (sibling merge, history, dispatches).

Next step: **Phase 5 — flow engine** (`add-flow-engine`), then the visual
builder and templates. Owner auto-capture of private messages must move
behind an explicit "new post" mode when public bot flows go live (§0.4).
