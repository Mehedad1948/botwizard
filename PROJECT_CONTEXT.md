# BotWizard Project Context

Last reviewed: 2026-06-08

This file is the onboarding reference for coding agents and contributors. It
describes the repository as it currently exists, including incomplete features
and known risks. Verify it against the code when making structural changes, and
update it when architecture or runtime behavior changes.

## Product Summary

BotWizard is a Persian, RTL Telegram automation application. A user connects
one or more Telegram bots, adds those bots to Telegram groups or channels,
captures posts through private bot messages, and creates immediate or recurring
delivery campaigns.

There are two user interfaces:

1. A Next.js web dashboard for login, bot management, posts, and campaigns.
2. Telegram conversations:
   - The main/platform bot registers users and connects user-owned bot tokens.
   - Each connected user bot manages drafts, destination chats, and campaigns.

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
- Telegram Bot HTTP API through native `fetch`
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
  page.tsx                           Unmodified starter landing page
  login/page.tsx                     Phone/OTP login UI
  actions/auth.ts                    OTP verification Server Action
  (dashboard)/
    layout.tsx                       Session-gated dashboard shell
    dashboard/page.tsx               User summary counts
    dashboard/bots/                  Bot list/add/delete UI and actions
    dashboard/posts/                 Saved post list and campaign creation
    dashboard/campaigns/             Campaign list/toggle/delete UI
  api/
    auth/request-otp/route.ts        Generates and sends OTP
    auth/telegram/route.ts           Telegram Login Widget authentication
    telegram/webhook/route.ts        Main bot webhook
    telegram/webhook/[token]/route.ts
                                       User-bot webhook dispatcher

lib/
  prisma/index.ts                    Prisma singleton
  session.ts                         JWT cookie creation and verification
  telegramAuth.ts                    Telegram Web App verification helper
  telegram/
    api.ts                           Generic Telegram API caller
    handlers/
      main.ts                        Main bot registration and management
      callback.ts                    User-bot inline-button state machine
      draft.ts                       Draft capture and specific-time setup
      group.ts                       Connected chat registration
      chats.ts                       Connected-chat menu
      campaigns.ts                   Campaign menu

prisma/
  schema.prisma                      Canonical data model
  migrations/                        PostgreSQL migration history

components/
  auth/TelegramLoginWidget.tsx       Alternative Telegram login client
  ui/                                Generated shadcn components

instrumentation.ts                   Optional process-wide outbound proxy
```

## Routes

### Pages

- `/` - Default Next.js starter page; not a product landing page yet.
- `/login` - Phone-based OTP flow.
- `/dashboard` - Counts bots, active campaigns, and posts for the session user.
- `/dashboard/bots` - Adds, lists, and deletes bots.
- `/dashboard/posts` - Lists posts and creates interval campaigns manually.
- `/dashboard/campaigns` - Lists, toggles, and deletes campaigns.

The dashboard sidebar currently links to dashboard, bots, and campaigns. It does
not link to `/dashboard/posts`, even though that page exists.

The login footer links to `/policy`, but no policy route exists.

### Route Handlers

- `POST /api/auth/request-otp`
- `POST /api/auth/telegram`
- `POST /api/telegram/webhook`
- `POST /api/telegram/webhook/:token`

Both main-bot webhook shapes exist. The registration flow for user bots points
to `/api/telegram/webhook/:token`. The root webhook is intended for the main
platform bot.

## Authentication and Session Flow

### Main OTP path

1. A Telegram user starts the platform bot.
2. The platform bot upserts a `User` by `telegramId`.
3. The user must share or otherwise acquire a stored phone number. No handler
   that accepts Telegram contact messages currently exists in this repository,
   so the intended phone-linking bootstrap appears incomplete.
4. `/login` sends the phone and delivery method to
   `/api/auth/request-otp`.
5. The route normalizes Iranian prefixes (`+98` or `98` to a leading `0`),
   finds the user by phone, stores a five-digit OTP for five minutes, and sends
   it through the main Telegram bot when `method === "telegram"`.
6. `verifyOtpAction` compares the code and expiry, clears OTP fields, then sets
   the session cookie.

SMS is selectable in the UI but is not implemented. The route still stores an
OTP and returns success without sending an SMS.

### Telegram Login Widget path

`POST /api/auth/telegram` verifies classic Telegram login data with
`TELEGRAM_LOGIN_BOT_TOKEN`, upserts a user by Telegram ID, and creates a
session. `TelegramLoginWidget.tsx` exists but is not rendered by the current
login page, and its comments suggest a newer OAuth payload that may not match
the route's classic hash verification.

### Session implementation

- Cookie name: `session`
- Payload: `{ userId, expires }`
- Signature: HS256 using `SESSION_SECRET`
- Lifetime: seven days
- Cookie: HTTP-only, `sameSite=lax`, secure in production, path `/`

`getSession()` verifies only the JWT signature/expiry. It does not confirm that
the user still exists or that the session has been revoked.

## Telegram Runtime Architecture

### Main/platform bot

Entry points:

- `app/api/telegram/webhook/route.ts`
- The main-token branch in `app/api/telegram/webhook/[token]/route.ts`

Responsibilities:

- Upsert a user on `/start`.
- Show bot-registration and bot-management menus.
- Detect raw BotFather tokens or `/addbot <token>`.
- Validate a user bot with `getMe`.
- Set the user bot webhook.
- Upsert the `Bot` record.
- Toggle bot activation and display active campaign counts.

The main bot token is `TELEGRAM_LOGIN_BOT_TOKEN`.

### User-owned bots

All user bots share the dynamic webhook route. The token in the URL is used to
look up the `Bot` record.

Before dispatching an update, the route:

1. Rejects unknown tokens.
2. Ignores inactive bots.
3. Extracts the Telegram sender.
4. Ignores updates unless the sender equals the bot owner's `telegramId`.

This owner-only check also applies to `my_chat_member` updates. That behavior
may prevent chat registration when Telegram reports a different actor or when
channel/group update shape differs.

Update dispatch:

- `/start` sends the user-bot management menu.
- `/campaigns` renders campaigns.
- Other private messages are treated as draft posts.
- `my_chat_member` upserts `ConnectedChat`.
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

A user-owned Telegram bot.

Key fields:

- Owner relation
- Raw Telegram bot token, stored in plaintext and unique
- Username
- Active flag
- Posts, campaigns, and connected chats

Deleting a bot cascades to its related records.

### `Post`

Saved content associated with one bot.

It can hold text, media URL/type, and Telegram source chat/message IDs.
Telegram-created posts currently rely primarily on source IDs.

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
- `MediaType`: `NONE`, `IMAGE`, `VIDEO`
- `ScheduleType`: `INTERVAL`, `SPECIFIC_TIMES`
- `SendStatus`: `SUCCESS`, `FAILED`

## Environment Variables

Required or referenced:

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - HS256 session signing secret
- `TELEGRAM_LOGIN_BOT_TOKEN` - Main bot token and login verification token
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - Main bot link on the login page
- `NEXT_PUBLIC_TELEGRAM_CLIENT_ID` - Used only by the unused login widget
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
- shadcn aliases use `@/components`, `@/components/ui`, and `@/lib`.
- UI components are a mix of Server Components and small Client Components.
- Most user-facing copy is Persian.

`components.json` points to `app/globals.css`, but the actual stylesheet is
`app/tailwindcss.css`. Account for this when generating new shadcn components.

## Security and Correctness Risks

Treat these as known issues, not established design choices:

1. Scheduled execution is absent.
2. Campaign toggle/delete Server Actions check for a session but do not scope
   the mutation to the current user's ownership.
3. Main-bot callback operations fetch bots by ID without verifying ownership by
   the callback sender.
4. User bot tokens are embedded directly in webhook URLs and stored plaintext.
   No Telegram webhook secret-token header is configured or verified.
5. `callTelegramAPI` catches transport errors but does not throw on Telegram API
   responses with `ok: false`; callers must check the response.
6. OTP generation uses `Math.random`, has no rate limit or attempt limit, and
   stores codes in plaintext.
7. Request-OTP does not validate the requested method and does not implement
   SMS delivery.
8. Telegram login verification uses normal string equality rather than a
   timing-safe comparison and does not enforce `auth_date` freshness.
9. `SESSION_SECRET` is read at module load without explicit validation.
10. The main webhook logs full Telegram updates, which may contain personal
    data.
11. Specific-time campaigns currently use the fixed `Asia/Tehran` timezone.
    There is no per-user timezone model.
12. Dashboard campaign display assumes interval scheduling and shows
    `intervalHours` even for specific-time campaigns.
13. Bot addition from the web dashboard validates and saves the token but does
    not call `setWebhook`; bot addition through the main Telegram bot does.
14. Deleting a bot in the database does not delete its Telegram webhook.
15. Several broad catch blocks replace useful validation errors with a generic
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
- `lib/telegramAuth.ts` appears unused.
- `TelegramLoginWidget.tsx` appears unused.
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
