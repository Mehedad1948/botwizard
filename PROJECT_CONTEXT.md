# BotWizard Project Context

Last reviewed: 2026-11-10

This file is the onboarding reference for coding agents and contributors. It
describes the repository as it currently exists, including incomplete features
and known risks. Verify it against the code when making structural changes, and
update it when architecture or runtime behavior changes.

## Product Summary

BotWizard is a Persian, RTL Telegram and Bale automation application. A user
connects bots and adds them to platform groups or channels,
captures posts through private bot messages, and creates immediate or recurring
delivery campaigns.

There are two user interfaces:

1. A Next.js web dashboard for login, bot management, posts, and campaigns.
2. Bot conversations:
   - The Telegram main bot registers users and connects Telegram bot tokens.
   - Connected Telegram and Bale bots manage drafts, destinations, and campaigns.

Scheduled delivery runs through `POST|GET /api/cron/tick` (protected by
`CRON_SECRET`), which is called every minute by the cron-job.org job
"BotWizard scheduler" (created/updated by `npm run cron:setup -- <prod URL>`,
using `CRON_JOB_API_KEY`). Locally use `npm run scheduler`. Without a caller
nothing is sent. Each tick stops after ~22s to fit cron-job.org's 30s limit.
The rebuild plan and product decisions live in `docs/REFACTOR_PLAN.md`; the
active OpenSpec change is `openspec/changes/rebuild-publishing-engine`.

## Technology Stack

- Next.js `16.2.7`, App Router
- React `19.2.4`
- TypeScript with strict mode
- PostgreSQL through Prisma `6.19.3`
- Tailwind CSS `4`
- shadcn/ui with Radix components
- `jose` for signed JWT session cookies
- `nuqs` for login-page query state
- Telegram and Bale Bot HTTP APIs through native `fetch`
- `undici` global proxy support from `instrumentation.ts`

The package name is `BotWizard`; the repository/directory name is `autopromo`.

## Mandatory Framework Rule

This project uses a Next.js version whose APIs may differ from prior versions.
Before changing Next.js code, read the relevant local guide under:

```text
node_modules/next/dist/docs/
```

Commonly relevant guides:

- `01-app/01-getting-started/02-project-structure.md`
- `01-app/01-getting-started/07-mutating-data.md`
- `01-app/01-getting-started/15-route-handlers.md`
- `01-app/03-api-reference/04-functions/cookies.md`
- `01-app/02-guides/authentication.md`
- `01-app/02-guides/instrumentation.md`

Observed Next.js 16 conventions already used by the project:

- `cookies()` is asynchronous.
- Dynamic route `params` is a promise in route handlers.
- Mutations use Server Actions and `revalidatePath`.
- Route groups such as `(dashboard)` do not affect the URL.

## Repository Map

```text
app/
  layout.tsx                         Root RTL layout and NuqsAdapter
  page.tsx                           Landing composition and content sections
  login/page.tsx                     Phone/OTP login UI
  actions/auth.ts                    OTP verification Server Action
  (site)/
    layout.tsx                       Shared public-site footer boundary
    page.tsx                         Landing composition and content sections
    login/page.tsx                   Phone/OTP login UI
  (dashboard)/
    layout.tsx                       Session-gated dashboard shell
    dashboard/[platform]/page.tsx    Platform-scoped summary counts
    dashboard/[platform]/bots/       Platform bot management
    dashboard/[platform]/campaigns/  Platform campaign management
    dashboard/[platform]/posts/      Redirect to platform campaigns
  api/
    auth/request-otp/route.ts        Generates and sends OTP
    auth/telegram/route.ts           Telegram Login Widget authentication
    telegram/webhook/route.ts        Main bot webhook
    telegram/webhook/[token]/route.ts
                                       Legacy Telegram dispatcher
    bots/webhook/[platform]/[token]/route.ts
                                       Legacy token-in-URL bot dispatcher
    bots/hook/[webhookId]/route.ts   Opaque, secret-verified bot webhook
    cron/tick/route.ts               Scheduler entry point

lib/
  prisma/index.ts                    Prisma singleton
  session.ts                         JWT cookie creation and verification
  auth.ts                            Phone, OTP, and one-time-token helpers
  telegram/
    api.ts                           Generic Telegram API caller
    handlers/
      main.ts                        Main bot registration and management

services/
  publishing/
    schedule.ts                      Pure schedule maths (next occurrence, validation)
    scheduler.ts                     Occurrence materialisation, delivery queue, send-now
    campaigns.ts                     Bot-scoped campaign operations
    content.ts                       Post capture from messages and send strategy
    posts.ts                         Dashboard post create/edit/upload/archive
    destinations.ts                  Membership updates and destination health
    errors.ts                        Delivery error classification (Persian messages)
    format.ts                        Persian schedule/date formatting
  owner-bot/                         Owner admin conversation (state + handler)
  bots/connection.ts                 Webhook registration, secret check, status
  dashboard/                         Page/action ownership helpers and loaders
  bot-platforms/
    config.ts                        Platform metadata and route helpers
    provider.ts                      Telegram/Bale HTTP API adapters
    context.ts                       Per-webhook provider context
    dispatch-update.ts               Shared owner-authorized dispatcher
    pairing.ts                       Hashed Bale owner pairing codes

prisma/
  schema.prisma                      Canonical data model
  migrations/                        PostgreSQL migration history

components/
  auth/TelegramLoginWidget.tsx       Alternative Telegram login client
  dashboard/CampaignCard.tsx         Shared campaign card for campaign and bot views
  dashboard/DashboardShell.tsx       Responsive dashboard navigation shell
  landing/LandingHero.tsx            Full-screen sticky landing hero
  landing/PageSection.tsx            Compound server-rendered content section
  site/SiteFooter.tsx                Shared Telegram/Bale public footer
  ui/                                Generated shadcn components

instrumentation.ts                   Optional process-wide outbound proxy
```

## Routes

### Pages

- `/` - Product landing page with a sticky full-screen framed hero, login CTA,
  and scroll-revealed content sections.
- `/login` - Phone-based OTP flow.
- `/dashboard` - Redirects to `/dashboard/telegram`.
- `/dashboard/:platform` - Platform-scoped summary for `telegram` or `bale`.
- `/dashboard/:platform/bots` - Adds, lists, and deletes platform bots.
- `/dashboard/:platform/bots/:botId` - Full bot workspace for status, campaigns, history,
  posts, and connected destinations.
- `/dashboard/:platform/bots/:botId/notifications` - Bot-scoped notification
  topics, private subscribers, preference visibility, and dispatch history.
- `/dashboard/:platform/posts` - Post library (filter by bot, archive);
  `/posts/new` composer with media upload; `/posts/:postId` edit + topics.
- `/dashboard/:platform/campaigns` - Campaign list filtered by status.
- `/dashboard/:platform/campaigns/new` - Wizard: post, destinations, schedule.
- `/dashboard/:platform/campaigns/:campaignId` - Schedule, upcoming runs,
  delivery log per run, edit form, destinations, subscriber notifications.
- Legacy unscoped dashboard routes redirect to the Telegram segment.

The login footer links to `/policy`, but no policy route exists.

### Route Handlers

- `POST /api/auth/request-otp`
- `POST /api/auth/telegram`
- `POST /api/auth/telegram/nonce`
- `GET /api/auth/telegram-link`
- `POST /api/telegram/webhook`
- `POST /api/telegram/webhook/:token`
- `POST /api/bots/webhook/:platform/:token` (legacy)
- `POST /api/bots/hook/:webhookId`
- `GET|POST /api/cron/tick`

The root Telegram webhook is for the main login bot. New user-bot registrations
point to the platform-neutral route. The dynamic Telegram route remains for
previously registered Telegram webhooks.

## Authentication and Session Flow

### Main OTP path

1. A Telegram user starts the platform bot.
2. The platform bot upserts a `User` by `telegramId` and asks users without a
   phone number to share their own Telegram contact.
3. Contact messages are accepted only when `contact.user_id` matches the
   Telegram sender. Iranian phone numbers are normalized and linked to the user.
4. After contact verification, the bot sends a five-minute, single-use login
   link backed by a hashed `LoginToken`.
5. The web login page can also request a five-digit Telegram OTP for an already
   linked phone number.
6. OTP codes are HMAC-hashed, expire after five minutes, are limited to five
   attempts, and have a one-minute resend cooldown.
7. The OTP challenge is stored in an HTTP-only cookie, so neither the phone nor
   OTP is placed in the login URL.

### Telegram Login Widget path

The login page uses Telegram's OIDC popup/postMessage protocol through a local
wrapper. Telegram's current `telegram-login.js?5` popup URL omits the required
`origin` parameter, so the wrapper explicitly sends the current website origin
and exact login-page redirect URI. Both must be registered under BotFather
**Bot Settings > Web Login > Allowed URLs** for every deployed domain. It
requests profile, verified phone, and bot write access. A server-generated
nonce is stored in an HTTP-only cookie, and `POST /api/auth/telegram` verifies
the returned ID token against Telegram's JWKS, issuer, audience, expiry, and
nonce before linking or
creating a user and issuing the application session.

Configure the production origin and login URL in BotFather under:
`Bot Settings > Web Login`. The Client ID belongs in
`NEXT_PUBLIC_TELEGRAM_CLIENT_ID`.

### Session implementation

- Cookie name: `session`
- Payload: `{ userId, expires, purpose: "session" }`
- Signature: HS256 using `SESSION_SECRET`
- Lifetime: thirty days
- Cookie: HTTP-only, `sameSite=lax`, secure in production, path `/`

`getSession()` verifies only the JWT signature/expiry. It does not confirm that
the user still exists or that the session has been revoked.

## Bot Platform Runtime Architecture

`Bot.platform` is the ownership boundary for dashboard queries and mutations.
Supported values are `TELEGRAM` and `BALE`. The dashboard switcher changes the
route segment, colors the active logo, and renders the inactive logo grayscale.

Both platforms implement one provider interface. Telegram calls
`https://api.telegram.org`; Bale calls `https://tapi.bale.ai`. Existing
conversation handlers run inside a request-local platform context so the same
state machine uses the correct provider.

### Main/platform bot

Entry points:

- `app/api/telegram/webhook/route.ts`
- The main-token branch in `app/api/telegram/webhook/[token]/route.ts`

Responsibilities:

- Upsert a user on `/start`.
- Show bot-registration and bot-management menus.
- Detect raw BotFather tokens or `/addbot <token>`.
- Validate a user bot with `getMe`.
- Set the Telegram user bot's platform-neutral webhook.
- Upsert the `Bot` record.
- Toggle bot activation and display active campaign counts.

The main bot token is `TELEGRAM_LOGIN_BOT_TOKEN`.

### User-owned bots

New bots are registered on `/api/bots/hook/:webhookId` (random id) with a
Telegram `secret_token` that the route verifies in constant time. Bale gets no
secret (support unverified). Bots registered before this change still use the
legacy `/api/bots/webhook/:platform/:token` URL until the owner presses
"اتصال دوباره" on the bot page, which rotates the webhook id and secret.

`services/bot-platforms/dispatch-update.ts` routes each update:

1. Inactive bots are ignored.
2. `my_chat_member` (Telegram) and group service messages (Bale joins/leaves,
   supergroup migration) update destinations. Only the owner can *add* a
   destination; removals and permission changes apply from anyone. The owner
   gets a private notice.
3. Bots without an owner accept only `/connect CODE` or `/start pair_CODE`.
4. Non-owner private messages go to the Telegram subscriber-preference flow.
5. Owner messages and callbacks go to `services/owner-bot/handler.ts`.

Owner conversation: `/start`, `/admin` or `/menu` open the menu; any other
private content (text, photo, video, animation, audio, document) is captured
as a post with `file_id`, caption and entities. Multi-step state lives in
`BotConversation` (24h TTL); callback data is `<scope>:<action>:<id>[:<arg>]`
and always < 64 bytes. Every callback re-checks `botId`. Typed schedule times
accept Persian digits. `/cancel` clears a pending question.

### Publishing model and delivery

- A `Campaign` publishes one `Post` to many destinations via `CampaignTarget`.
- Schedules: `ONCE`, `INTERVAL` (≥ 60 min, anchored at `startsAt`), `DAILY`
  (times), `WEEKLY` (weekdays 0=Sunday + times), all in `timezone`
  (default Asia/Tehran), with optional `endsAt`, `maxRuns`, `jitterMinutes`.
- The tick locks due campaigns (`FOR UPDATE SKIP LOCKED`), creates one
  `Delivery` per target and occurrence (unique key prevents duplicates),
  advances `nextRun` from `max(now, occurrence)` so outages produce one
  catch-up run, and marks finished campaigns `COMPLETED`.
- Deliveries are the queue: claimed with `SKIP LOCKED`, leased for 5 minutes,
  retried with backoff for `RATE_LIMITED`/`TRANSIENT` (max 5 attempts),
  failed immediately otherwise. `NO_PERMISSION`/`REMOVED` errors update the
  destination's health; non-active destinations are skipped.
- Send strategy: stored `mediaFileId`/entities first; legacy posts use
  `copyMessage` and fall back to stored text if the source message is gone.
- "Send now" (dashboard and bot) creates a completed `ONCE` campaign and runs
  the same delivery path synchronously.
- Subscriber notifications run once per occurrence with audience key
  `campaign:<id>`.

## Data Model

### `User`

Identity and login record. Supports nullable phone and Telegram identity,
profile fields, OTP fields, role, and owned bots.

Unique keys:

- `phone`
- `telegramId`

### `Bot`

A user-owned Telegram or Bale bot.

Key fields:

- Owner relation
- Platform enum
- Raw bot token, stored in plaintext and unique within its platform
- Username
- Platform-specific owner user ID
- Optional hashed and expiring owner-pairing code
- Active flag
- Posts, campaigns, and connected chats

Deleting a bot cascades to its related records.

### `Post`

Content owned by one bot: optional title, text/caption, Telegram entities
(non-null means "send from stored data"), media type and platform `file_id`,
URL buttons (`[[{text,url}]]`), source chat/message ids for provenance, and
`archivedAt`. Archiving pauses its active campaigns.

### `ConnectedChat` (destination)

A group/channel of one bot, unique by `(botId, chatId)`, with `chatType`,
`status` (`ACTIVE`, `NO_PERMISSION`, `REMOVED`), `statusReason`,
`lastCheckedAt`.

### `Campaign`, `CampaignTarget`

See "Publishing model and delivery". Status is `ACTIVE`, `PAUSED` or
`COMPLETED`; `nextRun` is null once completed.

### `Delivery`

One send of one campaign occurrence to one destination (title snapshot kept),
with trigger (`SCHEDULED`/`MANUAL`), status (`PENDING`, `SENDING`, `SENT`,
`FAILED`, `SKIPPED`), attempts, error kind and sanitized detail. Replaces the
former `PostHistory` table.

### `BotConversation`

Short-lived owner-bot conversation state keyed by an opaque id.

### Subscriber notification models

- `BotSubscriber` stores a private user scoped to one bot. It is created only
  from explicit private interaction, never from group/channel membership.
- `NotificationTopic` stores owner-defined, bot-scoped topics with a short
  callback key.
- `SubscriberTopicSubscription` stores enabled subscriber preferences.
- `PostNotificationTopic` attaches topics to posts.
- `SubscriberNotificationDispatch` is the occurrence-aware idempotency and
  delivery-history ledger for private sends.

`Campaign.notifySubscribers` enables the additive private delivery phase and
defaults to false. `Campaign.subscriberAudienceKey` lets sibling single-chat
campaign rows share one logical subscriber audience.

### Enums

- `Role`: `USER`, `ADMIN`
- `BotPlatform`: `TELEGRAM`, `BALE`
- `MediaType`: `NONE`, `IMAGE`, `VIDEO`
- `ScheduleType`: `INTERVAL`, `SPECIFIC_TIMES`
- `SendStatus`: `SUCCESS`, `FAILED`

## Environment Variables

Required or referenced:

- `DATABASE_URL` - PostgreSQL connection string
- `CRON_SECRET` - Bearer secret for `/api/cron/tick`; must match production
- `CRON_JOB_API_KEY` - cron-job.org API key, only for `npm run cron:setup`
- `SESSION_SECRET` - HS256 session signing secret
- `TELEGRAM_LOGIN_BOT_TOKEN` - Main/platform bot token
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - Main bot link on the login page
- `NEXT_PUBLIC_TELEGRAM_CLIENT_ID` - Telegram Web Login/OIDC Client ID
- `NEXT_PUBLIC_APP_BASE_URL` - Public base URL used to register user-bot webhooks
- `V2RAY_PROXY` - Optional outbound proxy URL
- `SUBSCRIBER_NOTIFICATIONS_ENABLED` - Set to `false` to disable private
  subscriber dispatch while retaining public campaigns.
- `SUBSCRIBER_NOTIFICATION_BATCH_SIZE` - Matching subscriber page size
  (default `50`).
- `SUBSCRIBER_NOTIFICATION_CONCURRENCY` - Concurrent private sends per batch
  (default `4`).
- `SUBSCRIBER_NOTIFICATION_RETRY_LIMIT` - Maximum dispatch attempts
  (default `3`).
- `SUBSCRIBER_NOTIFICATION_CLAIM_LEASE_MS` - Retry lease duration
  (default `300000`).

`NEXT_PUBLIC_APP_BASE_URL` falls back to a hard-coded Vercel deployment URL.
Avoid relying on that fallback in new environments.

Do not expose bot tokens, the database URL, or `SESSION_SECRET`. The `.env` file
is ignored by Git.

## Startup, Build, and Database

```powershell
cmd /c npm install
cmd /c npm run dev
cmd /c npm run lint
cmd /c npm run build
```

PowerShell script execution may block `npm.ps1`; use `cmd /c npm ...` when that
occurs.

The build script is:

```text
prisma generate && prisma migrate deploy && next build
```

This means production builds mutate the target database by applying pending
migrations. Confirm the selected `DATABASE_URL` before running a build.

There is no test script or test suite.

## Styling and UI Conventions

- The root document is Persian: `lang="fa"` and `dir="rtl"`.
- Public pages live under the URL-transparent `(site)` route group and share a
  dark responsive footer. Dashboard routes remain in `(dashboard)` and never
  render public-site chrome.
- The root font is `Vazirmatn` from `next/font/google`.
- Tailwind CSS is imported from `app/tailwindcss.css`.
- Brand colors use explicit semantic tokens: `brand-telegram` for Telegram blue,
  `brand-bale` for Bale green, and `brand-lilac` for decorative purple.
- `components/ui/button.tsx` includes landing variants `brand`, `brand-dark`,
  `brand-outline`, and `brand-ghost`, plus `brand` and `brand-sm` sizes.
- The landing illustration currently uses
  `public/bot-wizard.png` with `public/sparkles.png`, composed responsively in
  `components/landing/RobotHeroIllustration.tsx`.
- The full-width card rim is isolated in
  `components/landing/LandingNotch.tsx`. The page mirrors the same component
  vertically for the lower edge; the white card itself remains rectangular.
  Outer landing frame spacing is controlled by viewport padding on the parent
  rather than calculated heights.
- The hero markup is isolated in `components/landing/LandingHero.tsx` and stays
  sticky while the white content surface scrolls over it.
- Subsequent landing content uses the compound Server Component API
  `PageSection`, `PageSection.Image`, and `PageSection.Content`. On viewports
  at least `64rem` wide and `40rem` tall, every section is a full-viewport
  sticky sibling inside the `.landing-content-surface` grid, so later sheets
  slide over earlier ones. The sheets have rounded top corners that square off
  as each sheet lands, and they cast a soft shade on what they cover. Each
  sheet's bottom margin (`--landing-section-pause`) is a reading pause; the
  last sheet's pause comes from a trailing `::after` spacer, because a sticky
  element's own margin counts against its containing block. The hero card
  recedes slightly (`scroll(root)` timeline) as the first sheet covers it.
  Smaller or shorter viewports use normal flow so tall content is never hidden
  behind a pinned sheet; there only the surface itself is the rounded sheet.
  Reveals and these effects use CSS scroll/view timelines, unsupported
  browsers get a static layout, and motion is disabled for
  `prefers-reduced-motion`. Sections clip horizontal overflow, and the
  document and landing root use `overflow-x: clip`, so entrance transforms
  never create an x-axis scrollbar in RTL browsers. `#features` targets the
  section stack. The root `<html>` sets `data-scroll-behavior="smooth"` (the
  Next 16 opt-in), and smooth scrolling applies only without reduced motion.
- `/login` is a Server Component page that redirects signed-in users to
  `/dashboard` and renders `components/auth/LoginPageClient.tsx` inside a
  Suspense boundary (it reads search params). It uses a framed split layout:
  the form on one side and, on `lg`+, a dark brand panel.
- shadcn aliases use `@/components`, `@/components/ui`, and `@/lib`.
- UI components are a mix of Server Components and small Client Components.
- Most user-facing copy is Persian.
- The authenticated dashboard layout keeps session enforcement in the Server
  Component and passes page content into `DashboardShell`. The shell is the
  narrow Client Component responsible for active navigation state and the
  mobile overlay sidebar. The compact translucent header and sidebar brand row
  share the same height, sidebar navigation scrolls independently, and the main
  content uses a fixed low-contrast platform-tinted cloud background. The
  platform route sets semantic CSS variables on the shell: Telegram uses its
  blue brand and Bale uses its green brand for buttons, focus rings, navigation,
  icons, borders, card shadows, and restrained decorative surfaces. This is a
  CSS-only theme switch with no context provider or client-side theme state.
- The header/sidebar switcher displays both platform logos and only preserves
  list-level sections when changing platforms, so resource IDs never cross
  platform boundaries.
- The bot token form and platform-specific BotFather guide are hidden inside
  the client-side
  `AddBotPanel` until the user selects "افزودن ربات جدید". Campaign cards link
  to a dedicated detail route; the data model associates exactly one `Post`
  with each `Campaign`.
- `SiteFooter` is a Server Component with no client runtime. It includes the
  public CTA, product navigation, official Telegram/Bale documentation links,
  platform imagery, and copyright year.

`components.json` points to `app/globals.css`, but the actual stylesheet is
`app/tailwindcss.css`. Account for this when generating new shadcn components.

## Error Handling

- `app/not-found.tsx` handles unmatched routes and general `notFound()` calls.
- `app/error.tsx` is the root route-segment boundary for unexpected runtime
  errors.
- `app/global-error.tsx` replaces the root layout when the layout itself fails;
  it imports global CSS and defines its own `<html>` and `<body>`.
- `app/(dashboard)/error.tsx` keeps dashboard failures inside the authenticated
  shell and offers retry plus safe navigation.
- `app/(dashboard)/dashboard/[platform]/bots/[botId]/not-found.tsx` handles missing,
  deleted, or unauthorized bot IDs without revealing which case occurred.
- Error boundaries use Next.js 16.2's `unstable_retry()` prop. Expected
  validation and mutation failures should still be returned as visible action
  state rather than thrown.
- Client-visible error pages never render raw exception messages. They log the
  error and show only the optional Next.js digest as a support reference.
- `components/errors/ErrorState.tsx` is the shared RTL presentation component
  for full-page and dashboard-scoped error states.

## Security and Correctness Risks

Treat these as known issues, not established design choices:

1. Scheduled execution depends on an external per-minute caller of
   `/api/cron/tick` (cron-job.org). If that job is disabled (it is
   auto-disabled after repeated failures), nothing is sent.
2. The Telegram main bot remains the only account registration conversation;
   Bale ownership is bot-scoped through one-time pairing rather than a Bale
   account login flow.
3. User bot tokens are stored plaintext. Bots not yet re-registered still have
   the token in their legacy webhook URL; Bale webhooks carry no secret.
4. Provider calls normalize failed responses to `ok: false`; conversation
   handlers still must inspect responses where delivery success matters.
5. OTP and one-time login protection is application-level and not a substitute
   for infrastructure-level IP/device abuse controls.
6. Telegram OIDC account conflicts require manual support resolution rather
   than automatically merging two existing users.
7. One-time bot login tokens appear in the callback URL. They are random,
   hashed at rest, expire after five minutes, and are atomically consumed once.
8. Sessions are stateless JWTs and cannot currently be revoked individually.
9. Expired and consumed `LoginToken` rows are cleaned when a new token is
    issued for the same user, not by a global retention job.
10. Specific-time campaigns currently use the fixed `Asia/Tehran` timezone.
    There is no per-user timezone model.
11. Several broad catch blocks replace useful validation errors with a generic
    error, making operations difficult to diagnose.

## Development Guidance

- Keep authorization checks close to every database mutation. A dashboard
  layout redirect is not sufficient protection for Server Actions.
- Scope all bot, post, and campaign mutations by the authenticated user's ID.
- Preserve the separation between the main bot and user-bot handlers.
- When changing callback data, respect Telegram's 64-byte limit and avoid
  encoding unbounded state directly in button payloads.
- Prefer persisted workflow state keyed by a short opaque ID for multi-step
  Telegram interactions.
- Treat all Telegram API calls as untrusted network operations and inspect both
  HTTP status and Telegram's `ok` field.
- Send every post through `services/publishing/content.ts#sendPost` and every
  campaign run through `services/publishing/scheduler.ts`; do not call
  `copyMessage`/`sendMessage` for campaigns elsewhere.
- Campaign service functions take an already-authorised `botId` and filter by
  it; dashboard actions resolve it with `services/dashboard/access.ts`.
- Update this document when routes, environment variables, core flows, or
  operational assumptions change.

## Current Repository Hygiene

- The README is still the create-next-app template and is not a project guide.
- Vitest: `tests/publishing.test.ts` (schedule maths, error classification,
  content capture/send strategy, destination status, typed times) and the
  subscriber-notification tests. `tests/scheduler.int.test.ts` runs only with
  `TEST_DATABASE_URL` pointing at a disposable database (`npm run test:db`);
  it never uses `DATABASE_URL`.
- Never verify migrations with `DATABASE_URL` overrides on the Prisma CLI: it
  read `.env` instead. Use a schema copy with a hard-coded local URL.
- Migrations up to `20260613...` did not capture `Post.sourceChatId/
  sourceMessageId` or `Campaign.scheduleType/specificTimes` (they came from
  `db push`); `20261109000000_reconcile_schema_drift` adds them idempotently.
- No CI configuration exists.
- Logout is handled through a Server Action that clears OTP/session cookies and redirects to `/login`.

## First Steps for Future Agents

1. Read `AGENTS.md` and the relevant local Next.js 16 docs.
2. Read this file, then inspect the specific source files for the requested area.
3. Check `git status` and preserve user changes.
4. Confirm environment/database implications before running `npm run build`.
5. For Telegram changes, trace both webhook routing and callback payloads.
6. For data changes, update `prisma/schema.prisma`, create a migration, and
   revisit cascade and ownership behavior.
7. Run focused validation first, then `cmd /c npm run lint`; run the production
   build only when applying migrations to the configured database is intended.
