## Why

Publishing is the product's core promise, and today it does not work: nothing
executes scheduled campaigns, one campaign row exists per destination chat,
content depends on the owner never deleting their private draft message, and
the bot conversation encodes selections in truncated callback data and binds
campaigns to the wrong post. Users cannot rely on any of it.

## What Changes

- **BREAKING (data model):** a campaign publishes one post to **many**
  destinations through `CampaignTarget`. Existing sibling campaigns are merged.
- Schedules become `ONCE`, `INTERVAL` (minutes, min 60), `DAILY` (times) and
  `WEEKLY` (weekdays + times) with timezone, start, optional end, max runs and
  jitter. Campaign status is `ACTIVE`, `PAUSED` or `COMPLETED`.
- A scheduler (`POST /api/cron/tick`, `CRON_SECRET`) materialises due
  occurrences into `Delivery` rows and sends them with retries, backoff and
  rate-limit handling. Running ticks concurrently never double-sends.
- `Delivery` replaces `PostHistory` as the per-destination, per-occurrence log
  with plain-language error explanations.
- Posts store media `file_id`, formatting entities and URL buttons, so delivery
  no longer depends on the original private message.
- Destinations track type and health (`ACTIVE`, `NO_PERMISSION`, `REMOVED`),
  updated from membership updates and delivery errors.
- Bots receive webhooks on an opaque `webhookId` URL with a Telegram secret
  token; the token is no longer in new webhook URLs. Legacy URLs keep working.
- The owner bot conversation is rebuilt on short-lived server-side state with
  ownership checks on every callback.
- Dashboard publishing pages are rebuilt on the new model (composer, campaign
  wizard, campaign detail with delivery log).

## Capabilities

### New Capabilities

- `publishing`: content, destinations, multi-destination campaigns, schedule
  rules, scheduler, delivery log, owner bot publishing conversation.

### Modified Capabilities

- `audience-notifications` (in-progress change): subscriber notification is
  triggered once per campaign occurrence; the audience key becomes the campaign
  id because sibling campaigns no longer exist.

## Non-Goals

- Visual flow builder and customer-facing bot behaviour (later change).
- Cross-posting one content item to Telegram and Bale bots together.
- Bot token encryption at rest (hardening change).
- Albums (media groups) as a single post.
