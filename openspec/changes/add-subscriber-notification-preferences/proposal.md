## Why

Bots currently publish campaigns only to connected groups and channels, so businesses cannot offer opt-in, private alerts tailored to an individual user's interests. Subscriber Notification Preferences adds that second audience type now, while the existing post and campaign model is still small enough to extend without replacing or disrupting public chat delivery.

## What Changes

- Register a bot-scoped subscriber only after a person privately interacts with that bot; group or channel membership never creates a subscriber.
- Let bot owners create and manage reusable notification topics under an owned bot.
- Let private subscribers use `/start`, `/topics`, `/notify`, `/settings`, `/stop`, and inline buttons to manage topic preferences.
- Let owners assign one or more notification topics to a post.
- Add an optional `notifySubscribers` campaign delivery path that privately sends the post to active subscribers matching at least one assigned topic.
- Record one idempotent delivery attempt per subscriber and campaign occurrence, including sent, failed, skipped, and blocked outcomes.
- Add bot-scoped dashboard views for topic management, subscriber discovery, preference visibility, and notification delivery history.
- Process subscriber sends in bounded batches with retry-safe deduplication and rate-limit handling.
- Preserve existing `ConnectedChat` and single-`chatId` campaign behavior. Subscriber notification is additive and disabled by default.

## Capabilities

### New Capabilities

- `audience-notifications`: Bot-scoped private subscribers, owner-defined topics, subscriber preference commands, post topic assignment, optional campaign notification delivery, dispatch history, ownership controls, and backward compatibility.

### Modified Capabilities

None. The repository has no existing baseline OpenSpec capabilities; compatibility requirements for current campaigns are included in the new capability.

## Scope

- Telegram-first private subscriber registration and command handling.
- Platform-neutral persistence and service boundaries suitable for Bale support where its bot API permits equivalent behavior.
- Topic-based matching with OR semantics: a subscriber matches when at least one enabled subscription matches a topic assigned to the post.
- Reuse of existing post text/media for the private notification in the MVP.
- Integration points for both scheduled campaign execution and retryable batch delivery.

## Non-Goals

- Importing or inferring subscribers from group/channel membership.
- Sending private messages to users who have never interacted with the bot.
- Advanced inventory, saved search, price/year/mileage filtering, AI matching, billing, CRM notes, Mini Apps, custom notification templates, or a visual automation builder.
- Replacing the current `ConnectedChat`, post, campaign, or public chat delivery system.
- Building a general campaign-target abstraction in this change.

## Migration Impact

- Add subscriber, topic, preference, post-topic, and notification-dispatch tables plus their enums, relations, uniqueness constraints, and query indexes.
- Add `notifySubscribers Boolean @default(false)` to `Campaign`, so existing rows and behavior remain unchanged after migration.
- Add relations to `Bot`, `Post`, and `Campaign`; no existing data backfill is required.
- Introduce a private-subscriber webhook branch before the existing owner-only bot-management dispatcher. Subscriber commands expose only preference operations and do not weaken owner authorization.
- Add a batch dispatch service contract. The project currently has no operational scheduler/queue, so the future implementation must connect this service to the campaign runner when that runner is implemented, while also supporting testable/manual invocation.

## Risk Summary

- **Unauthorized access:** every dashboard query and mutation must traverse an authenticated user's owned bot; callback updates must be bot-scoped and sender-scoped.
- **Duplicate or repeated delivery:** retries and recurring campaigns require a unique dispatch key that includes the logical campaign occurrence, post, and subscriber; a nullable compound key alone is insufficient.
- **Rate limits and large audiences:** matching and sending must be paginated, bounded, and retry-aware rather than loading all subscribers into memory.
- **Blocked bots and stale recipients:** provider-specific blocked errors must update subscriber status without failing public campaign delivery.
- **Webhook authorization regression:** subscriber handling must remain isolated from owner commands so private users cannot invoke bot-management actions.
- **Cross-platform drift:** storage and service interfaces remain platform-neutral even though Telegram webhook behavior is the MVP implementation target.
