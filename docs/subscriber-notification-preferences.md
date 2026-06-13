# Subscriber Notification Preferences

## Consent Boundary

A subscriber is created only after a person sends `/start` to a user-owned
Telegram bot in a private chat. Group or channel membership never creates a
subscriber and does not grant permission for private messages.

Subscriber commands:

- `/start`: create or reactivate the bot-scoped subscriber.
- `/topics`, `/notify`, `/settings`: show active topics and current choices.
- `/stop`: set the subscriber to `UNSUBSCRIBED`.

Inline callbacks use the reserved `topic:*` namespace. Topic callback keys are
short, opaque, bot-scoped values. The webhook validates the private chat,
Telegram sender, subscriber, bot, topic, and callback action before mutation.
Subscriber handling is separate from the existing owner-only command
dispatcher.

## Matching and Delivery

Topics belong to one bot. Posts can have zero or more topics. Matching uses OR
semantics: an active subscriber is eligible when at least one enabled
subscription matches an active topic on the post.

Campaign public delivery remains unchanged and always targets its existing
`chatId`. Private subscriber delivery is an optional second phase controlled by
`Campaign.notifySubscribers`. Existing campaigns default to `false`.

Private delivery reuses the post's source message through `copyMessage` when
available, otherwise it sends the stored post text. Subscriber failures do not
roll back successful public delivery.

## Idempotency and Batching

Every private attempt is represented by `SubscriberNotificationDispatch`.
`dispatchKey` is derived from the logical audience, campaign occurrence, post,
and subscriber. This prevents duplicate work during retries and across sibling
campaign rows representing multiple public destinations.

Audience selection uses bot/status/topic predicates and ID cursor pagination.
Sending uses bounded concurrency. Supported settings:

```text
SUBSCRIBER_NOTIFICATIONS_ENABLED=true
SUBSCRIBER_NOTIFICATION_BATCH_SIZE=50
SUBSCRIBER_NOTIFICATION_CONCURRENCY=4
SUBSCRIBER_NOTIFICATION_RETRY_LIMIT=3
SUBSCRIBER_NOTIFICATION_CLAIM_LEASE_MS=300000
```

The values above are defaults when variables are absent. Setting
`SUBSCRIBER_NOTIFICATIONS_ENABLED=false` disables the private dispatch phase
without changing public campaigns or deleting subscriber data.

## Provider Errors

Provider responses are classified as:

- blocked or unavailable private chat;
- rate limited, including `retry_after`;
- transient;
- terminal.

Blocked results set both the dispatch and subscriber to `BLOCKED`. Other
failures remain on the same dispatch record for bounded retry. Stored errors
are length-limited and redact recognizable bot tokens and authorization data.

## Ownership and Personal Data

Dashboard operations authorize through the authenticated user's owned bot and
selected platform before loading or mutating child resources. A topic from a
different bot cannot be assigned to a post, even when both bots have the same
owner.

Stored subscriber data includes platform user ID, private chat ID, available
profile names, username, language, status, source/start parameter, and
interaction timestamps. Dispatch history stores delivery state and sanitized
errors.

The MVP retains subscriber preferences and dispatch history when `/stop` is
used so consent history and reactivation remain consistent. Production
operators must define account-deletion and time-based retention policies before
broad rollout. No manual subscriber import is supported.

## Scheduler Contract

This repository still has no cron worker, durable queue, or due-campaign
scheduler. `dispatchCampaignSubscribers` is the reusable private delivery
phase, and the existing authenticated manual campaign-send action invokes it
after successful public delivery.

A future scheduler must:

1. provide a stable occurrence identity for each scheduled run;
2. execute the existing public delivery;
3. invoke subscriber delivery only when `notifySubscribers` is true;
4. retain the same occurrence identity for retries;
5. atomically advance `nextRun`;
6. avoid concurrent public sends and use dispatch claims for private sends.

## Rollout

1. Apply and verify the additive Prisma migration.
2. Keep subscriber dispatch disabled until webhook commands and dashboard topic
   configuration are verified with an internal Telegram bot.
3. Enable the feature for internal bots and monitor dispatch status/error
   counts.
4. Tune batch size and concurrency against Telegram rate limits.
5. Verify Bale callback and blocked-user semantics before enabling Bale private
   subscriber commands.
