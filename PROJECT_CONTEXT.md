# BotWizard Project Context

Last reviewed: 2026-06-10

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

Important current-state distinction: campaign records can be created and
managed, but this repository contains no scheduler, queue, cron route, or
background worker that processes due campaigns. Scheduled delivery is therefore
not operational from this codebase alone.

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
                                       Platform-neutral bot dispatcher

lib/
  prisma/index.ts                    Prisma singleton
  session.ts                         JWT cookie creation and verification
  auth.ts                            Phone, OTP, and one-time-token helpers
  telegram/
    api.ts                           Generic Telegram API caller
    handlers/
      main.ts                        Main bot registration and management
      callback.ts                    User-bot inline-button state machine
      draft.ts                       Draft capture and specific-time setup
      group.ts                       Connected chat registration
      chats.ts                       Connected-chat menu
      campaigns.ts                   Campaign menu

services/
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
  dashboard/DashboardShell.tsx       Responsive dashboard navigation shell
  landing/LandingHero.tsx            Full-screen sticky landing hero
  landing/PageSection.tsx            Compound server-rendered content section
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
- `/dashboard/:platform/posts` - Redirects to that platform's campaigns.
- `/dashboard/:platform/campaigns` - Platform campaign list and controls.
- `/dashboard/:platform/campaigns/:campaignId` - Campaign details and associated post,
  recent history, immediate send, and new scheduling actions.
- Legacy unscoped dashboard routes redirect to the Telegram segment.

The login footer links to `/policy`, but no policy route exists.

### Route Handlers

- `POST /api/auth/request-otp`
- `POST /api/auth/telegram`
- `POST /api/auth/telegram/nonce`
- `GET /api/auth/telegram-link`
- `POST /api/telegram/webhook`
- `POST /api/telegram/webhook/:token`
- `POST /api/bots/webhook/:platform/:token`

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
- Lifetime: seven days
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

New user bots share `/api/bots/webhook/:platform/:token`. Platform and token
together identify the `Bot` record.

Before dispatching an update, the route:

1. Rejects unknown tokens.
2. Ignores inactive bots.
3. Extracts the platform sender.
4. Ignores updates unless the sender equals `Bot.ownerPlatformUserId`.

Telegram group joins use `my_chat_member`; Bale group joins use
`message.new_chat_members`. Both are normalized into `ConnectedChat` records
and remain owner-authorized.

Telegram bots inherit the linked Telegram ID as their platform owner. Bale IDs
are separate, so adding a Bale bot creates a hashed, 30-minute one-time code.
The owner sends `/connect CODE` privately to bind their Bale ID. The dashboard
can regenerate an expired code.

Update dispatch:

- `/start` sends the user-bot management menu.
- `/campaigns` renders campaigns.
- Other private messages are treated as draft posts.
- Platform-specific membership updates upsert `ConnectedChat`.
- Callback queries enter the large inline-button workflow in `callback.ts`.

### Draft and immediate-send flow

1. The owner sends text or media to a user bot in a private chat.
2. `handleDraftPost` creates a `Post` with source chat/message IDs.
3. The bot offers immediate send, scheduling, or cancel.
4. Destination chats come from `ConnectedChat`.
5. Immediate delivery uses Telegram `copyMessage` from the owner's private
   message to each selected chat.

Media metadata is not populated during Telegram draft capture. The database
record stores a text/caption preview and source message identity; actual
immediate delivery relies on `copyMessage`.

### Campaign creation flow

Each target chat receives a separate `Campaign` row.

Supported schedule records:

- `INTERVAL`: selected interval and computed `nextRun`.
- `SPECIFIC_TIMES`: an array of `HH:MM` strings and the nearest `nextRun`.

Campaigns can be created from:

- Telegram inline-button workflows.
- The web posts page, using a manually entered chat ID and interval.

The Telegram callback payload encodes selected chat IDs and truncates strings to
Telegram's 64-byte callback-data limit. Selecting many chats can silently
truncate IDs and corrupt the workflow.

Campaign creation sometimes finds the latest post for the bot rather than the
post identified by the callback draft ID. Concurrent drafts can therefore bind
a campaign to the wrong post.

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

Saved content associated with one bot.

It can hold text, media URL/type, and platform source chat/message IDs.
Bot-created posts currently rely primarily on source IDs.

### `ConnectedChat`

A known target group/channel for one bot. Uniqueness is `(botId, chatId)`.

### `Campaign`

Joins a post and bot to one target chat and one schedule. It stores interval or
specific-time configuration, activation, optional random-delay intent, and
`nextRun`.

### `PostHistory`

Designed to record campaign send success/failure. No current runtime writes to
this table.

### Enums

- `Role`: `USER`, `ADMIN`
- `BotPlatform`: `TELEGRAM`, `BALE`
- `MediaType`: `NONE`, `IMAGE`, `VIDEO`
- `ScheduleType`: `INTERVAL`, `SPECIFIC_TIMES`
- `SendStatus`: `SUCCESS`, `FAILED`

## Environment Variables

Required or referenced:

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - HS256 session signing secret
- `TELEGRAM_LOGIN_BOT_TOKEN` - Main/platform bot token
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - Main bot link on the login page
- `NEXT_PUBLIC_TELEGRAM_CLIENT_ID` - Telegram Web Login/OIDC Client ID
- `NEXT_PUBLIC_APP_BASE_URL` - Public base URL used to register user-bot webhooks
- `V2RAY_PROXY` - Optional outbound proxy URL

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
  `PageSection`, `PageSection.Image`, and `PageSection.Content`. Its reveal
  effects use CSS view timelines, and each viewport-height section sticks and
  is covered by the next square-cornered section without a broad section
  shadow. Each section has extra scroll track after becoming fully visible so
  readers have a pause before the next sheet arrives. Unsupported browsers
  receive a fully visible static layout, and motion is disabled for
  `prefers-reduced-motion`.
- shadcn aliases use `@/components`, `@/components/ui`, and `@/lib`.
- UI components are a mix of Server Components and small Client Components.
- Most user-facing copy is Persian.
- The authenticated dashboard layout keeps session enforcement in the Server
  Component and passes page content into `DashboardShell`. The shell is the
  narrow Client Component responsible for active navigation state and the
  mobile overlay sidebar. The compact translucent header and sidebar brand row
  share the same height, sidebar navigation scrolls independently, and the main
  content uses a fixed low-contrast blue cloud background. Dashboard navigation,
  buttons, icons, card borders, and shadows share one restrained Telegram-blue
  accent; secondary colors are reserved for semantic statuses and warnings.
- The header/sidebar switcher displays both platform logos and only preserves
  list-level sections when changing platforms, so resource IDs never cross
  platform boundaries.
- The bot token form and platform-specific BotFather guide are hidden inside
  the client-side
  `AddBotPanel` until the user selects "افزودن ربات جدید". Campaign cards link
  to a dedicated detail route; the data model associates exactly one `Post`
  with each `Campaign`.

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

1. Scheduled execution is absent.
2. The Telegram main bot remains the only account registration conversation;
   Bale ownership is bot-scoped through one-time pairing rather than a Bale
   account login flow.
3. User bot tokens are embedded directly in webhook URLs and stored plaintext.
   No provider webhook secret header is configured or verified.
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
- Use database transactions when one logical action creates multiple campaign
  rows.
- Define timezone behavior before implementing the scheduler.
- If implementing scheduled delivery, use `Post.sourceChatId` and
  `Post.sourceMessageId` with `copyMessage`, update `nextRun` atomically, and
  write `PostHistory`.
- Add idempotency/locking before running scheduler work concurrently.
- Update this document when routes, environment variables, core flows, or
  operational assumptions change.

## Current Repository Hygiene

- The README is still the create-next-app template and is not a project guide.
- No automated tests exist.
- No CI configuration exists.
- No scheduler/deployment configuration exists.
- No logout action exists.
- `createPostAction` exists, but the current posts page has no create-post form.
- The posts page contains a debug `console.log`.

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
