## Context

The application manages Telegram and Bale bots through platform-scoped dashboard routes and provider adapters. A bot owner can create posts and single-destination campaigns that publish to a `ConnectedChat` group or channel through `Campaign.chatId`. There is no private audience model, preference store, or subscriber dispatch ledger.

The current user-bot webhook dispatcher authorizes only the bot owner by comparing the update sender with `Bot.ownerPlatformUserId`. Subscriber commands therefore cannot be added by simply relaxing that check: doing so would expose owner management commands. The webhook needs an isolated subscriber-command branch with a deliberately narrow action set.

The project also does not currently have an operational scheduler, cron worker, or durable queue. This design defines a batch dispatch service and campaign-run contract that can be called by the future scheduler and by controlled manual/test execution. It does not claim scheduled execution already exists.

Stakeholders are bot owners who configure topics and campaigns, private bot users who opt into topics, and operators who need bounded, observable, retry-safe delivery.

## Goals / Non-Goals

**Goals:**

- Add a second, opt-in private audience without changing public `ConnectedChat` delivery.
- Keep all subscriber, topic, preference, and delivery data scoped to one bot.
- Provide Telegram-first `/start`, topic settings, and unsubscribe behavior.
- Use platform-neutral persistence and service contracts so Bale can adopt equivalent behavior later.
- Support OR-based topic matching, durable delivery history, safe retries, and bounded batches.
- Enforce owner authorization on every dashboard operation and sender/bot authorization on every callback.
- Preserve existing campaigns through additive nullable/defaulted schema changes.

**Non-Goals:**

- Deriving subscribers from group/channel membership or contacting users who never opened the bot.
- Saved searches, inventory attributes, AI matching, billing, CRM, Mini Apps, imported audiences, custom templates, or a visual automation builder.
- Replacing `Campaign.chatId` with a generalized target graph.
- Implementing a complete distributed scheduler or queue as part of the preference capability.
- Guaranteeing Bale command support until its provider adapter and webhook behavior are verified against Bale's API.

## Decisions

### 1. Keep subscribers separate from connected public destinations

`ConnectedChat` remains a group/channel publication destination. `BotSubscriber` represents a platform user and private chat established by explicit private interaction with one bot. No synchronization or inference occurs between these models.

This separation preserves Telegram's permission boundary: knowing a channel member does not grant a bot permission or a private chat through which to message that person.

**Alternative considered:** model every audience as a generic destination. Rejected for this change because it would require replacing stable campaign behavior and would conflate public destinations with people, consent, status, and preferences.

### 2. Use platform-neutral identity names in the database

The suggested `telegramUserId` field will be named `platformUserId`. Its value is Telegram `from.id` for the Telegram MVP and the equivalent provider identity for Bale. `privateChatId` remains generic. The subscriber does not need its own platform column because `Bot.platform` is authoritative.

This is an intentional naming refinement to avoid a future migration when Bale subscriber support is added.

### 3. Add the following Prisma entities and relations

The future migration should implement the conceptual schema below. Exact relation names can follow the repository's Prisma conventions.

```prisma
enum SubscriberStatus {
  ACTIVE
  UNSUBSCRIBED
  BLOCKED
}

enum NotificationDispatchStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
  BLOCKED
}

model BotSubscriber {
  id                String           @id @default(cuid())
  botId             String
  bot               Bot              @relation(fields: [botId], references: [id], onDelete: Cascade)
  platformUserId    String
  privateChatId     String
  username          String?
  firstName         String?
  lastName          String?
  languageCode      String?
  status            SubscriberStatus @default(ACTIVE)
  source            String?
  startParameter    String?
  firstSeenAt       DateTime         @default(now())
  lastSeenAt        DateTime?
  lastInteractionAt DateTime?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  subscriptions     SubscriberTopicSubscription[]
  dispatches        SubscriberNotificationDispatch[]

  @@unique([botId, platformUserId])
  @@index([botId])
  @@index([status])
  @@index([lastInteractionAt])
  @@index([botId, status, id])
}

model NotificationTopic {
  id            String       @id @default(cuid())
  botId         String
  bot           Bot          @relation(fields: [botId], references: [id], onDelete: Cascade)
  name          String
  slug          String
  callbackKey   String
  description   String?
  isActive      Boolean      @default(true)
  sortOrder     Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  subscriptions SubscriberTopicSubscription[]
  posts         PostNotificationTopic[]

  @@unique([botId, slug])
  @@unique([botId, callbackKey])
  @@index([botId])
  @@index([isActive])
  @@index([botId, isActive, sortOrder])
}

model SubscriberTopicSubscription {
  id           String          @id @default(cuid())
  subscriberId String
  subscriber   BotSubscriber   @relation(fields: [subscriberId], references: [id], onDelete: Cascade)
  topicId      String
  topic        NotificationTopic @relation(fields: [topicId], references: [id], onDelete: Restrict)
  isEnabled    Boolean         @default(true)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([subscriberId, topicId])
  @@index([topicId])
  @@index([isEnabled])
  @@index([topicId, isEnabled, subscriberId])
}

model PostNotificationTopic {
  id        String            @id @default(cuid())
  postId    String
  post      Post              @relation(fields: [postId], references: [id], onDelete: Cascade)
  topicId   String
  topic     NotificationTopic @relation(fields: [topicId], references: [id], onDelete: Restrict)
  createdAt DateTime          @default(now())

  @@unique([postId, topicId])
  @@index([topicId])
}

model SubscriberNotificationDispatch {
  id             String                     @id @default(cuid())
  dispatchKey    String                     @unique
  botId          String
  bot            Bot                        @relation(fields: [botId], references: [id], onDelete: Cascade)
  campaignId     String?
  campaign       Campaign?                  @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  postId         String
  post           Post                       @relation(fields: [postId], references: [id], onDelete: Restrict)
  subscriberId   String
  subscriber     BotSubscriber              @relation(fields: [subscriberId], references: [id], onDelete: Restrict)
  occurrenceKey  String
  scheduledFor   DateTime?
  status         NotificationDispatchStatus @default(PENDING)
  attemptCount   Int                        @default(0)
  errorLog       String?
  lastAttemptAt  DateTime?
  sentAt         DateTime?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt

  @@index([botId])
  @@index([campaignId])
  @@index([postId])
  @@index([subscriberId])
  @@index([status])
  @@index([botId, status, id])
}
```

`Bot`, `Post`, and `Campaign` gain the corresponding relation fields. `Campaign` gains:

```prisma
notifySubscribers     Boolean @default(false)
subscriberAudienceKey String?
```

`subscriberAudienceKey` identifies sibling campaign rows created for multiple public destinations as one logical subscriber send. For an isolated campaign it can be generated from the campaign identity. The executor combines this key, the recurring occurrence, post, and subscriber into `dispatchKey`.

A short, application-generated `NotificationTopic.callbackKey` avoids putting a cuid and verbose action text into Telegram's callback-data limit. It is opaque, unique within a bot, and always resolved through that bot.

**Alternatives considered:**

- A nullable `@@unique([campaignId, postId, subscriberId])` was rejected because PostgreSQL permits multiple null values and because it would suppress all later occurrences of a recurring campaign.
- Storing topic IDs directly in arrays was rejected because relational joins, referential integrity, filtering, and indexes are required.
- Naming the identity `telegramUserId` was rejected because the bot already supplies the platform scope.

### 4. Match any enabled topic and preserve explicit consent state

Matching uses OR semantics: an active subscriber qualifies when at least one enabled subscription joins to one active topic assigned to the post. Matching the same subscriber through multiple topics is collapsed to one subscriber ID.

`/stop` changes only status to `UNSUBSCRIBED`; subscriptions remain for history and convenient reactivation. `/start` after a successful new private interaction returns the user to `ACTIVE` but does not create or enable topic subscriptions. A successful interaction from a previously blocked subscriber may restore `ACTIVE`, since the provider has demonstrated that the private chat is available again.

Inactive topics are omitted from subscriber selection and campaign matching. Existing subscriptions and post links remain stored. Hard deletion is allowed only when no references exist; otherwise the dashboard deactivates the topic.

**Alternative considered:** require all selected post topics to match. Rejected because category alerts normally represent independent interests and the requested examples imply any-topic matching.

### 5. Isolate subscriber webhook handling from owner commands

The provider webhook route continues to resolve the bot from the route and token, validate the update, and dispatch through platform services. For Telegram private updates, processing order is:

1. Reject unsupported or non-private subscriber operations.
2. Recognize only `/start`, `/topics`, `/notify`, `/settings`, `/stop`, and the reserved subscriber callback namespace.
3. Route those operations to a subscriber preference service with the resolved bot and Telegram sender/chat identity.
4. Route all other bot-management behavior through the existing owner-only authorization and dispatcher.

The subscriber branch has no access to bot creation, campaign management, tokens, connected chats, or owner commands.

`/start` parses the optional deep-link parameter with length and character limits, upserts by `(botId, platformUserId)`, updates private chat/profile metadata and timestamps, and returns onboarding plus a topic button. Other recognized commands require an existing subscriber or direct the user through `/start`.

Suggested callback shapes are:

```text
topic:toggle:<callbackKey>
topic:list
topic:stop
```

Parsing uses an exact action allowlist and segment count. A toggle resolves `callbackKey` with the current `botId`, verifies the callback sender matches the subscriber's `platformUserId`, verifies the callback chat is private, and performs an atomic upsert/toggle. No callback-supplied bot or subscriber ID is trusted.

### 6. Put dashboard functionality under the selected bot

The preferred route is:

```text
/dashboard/[platform]/bots/[botId]/notifications
```

This route keeps audience ownership visibly anchored to a bot and can contain tabs or sections for Topics, Subscribers, and Delivery History.

Server-side loaders and mutations first resolve the authenticated user's bot using `userId + botId + platform`. Child identifiers are then queried or mutated through that owned bot. Supplying a topic from another owned bot is still invalid for a post because notification topics must match the post's bot.

Post create/edit UI adds multi-topic selection. Campaign create/edit UI adds `Notify matching subscribers`, disabled or warned when the post has no active topics. The UI must state that only users who privately started the bot and selected a matching topic can receive notifications.

Subscriber list queries use server-side pagination and support status, topic, and normalized search across username, names, and platform user ID. Delivery history exposes sanitized errors, not bot tokens or raw provider payloads.

### 7. Keep public and private campaign outcomes independent

For each campaign occurrence:

1. Execute the existing `chatId` public delivery without changing its current implementation.
2. If `notifySubscribers` is false, return without subscriber work.
3. Resolve the post's active topics. If none exist, record/log a skipped subscriber phase and return.
4. Establish an immutable `occurrenceKey` from the logical subscriber audience and scheduled occurrence. Manual invocations use an explicit operation ID.
5. Page matching active subscriber IDs in deterministic keyset order.
6. Insert-or-load one `PENDING` dispatch using a unique `dispatchKey`.
7. Skip a dispatch already marked `SENT` or `BLOCKED`; claim retryable records without creating another row.
8. Send by the bot's platform adapter, reusing the post text/media for the MVP.
9. Update the dispatch result and continue independently for every subscriber.

Public success is never rolled back because subscriber delivery failed. Subscriber execution may run after public sending or be enqueued alongside it, provided both outcomes remain independent.

Where one owner action creates multiple single-chat campaign rows, those rows share `subscriberAudienceKey`. The execution layer either elects one row to enqueue subscriber work or relies on the shared occurrence/dispatch keys so concurrent rows converge on the same dispatch records. This prevents one private copy per public destination.

### 8. Use durable dispatch rows for idempotency and retries

`dispatchKey` is a stable hash or canonical string derived from:

```text
subscriberAudienceKey | occurrenceKey | postId | subscriberId
```

The unique database constraint is the concurrency boundary. The worker creates the row before provider I/O, increments attempt metadata on retries, and updates the same row. A `SENT` row is terminal and never sent again for that occurrence.

`PENDING` represents queued or claimed work. `FAILED` includes sanitized error data and is retryable only when the classified error and attempt policy allow it. `SKIPPED` is terminal for an invalid/ineligible delivery discovered after dispatch creation. `BLOCKED` is terminal and also updates the subscriber.

Workers must use a claim/lease strategy or transactional status transition so two processes do not send the same pending dispatch concurrently. If the MVP runs in one process, the service interface and database uniqueness still preserve a migration path to a queue worker.

### 9. Batch by cursor and apply provider-aware throttling

The audience query selects only IDs required for dispatch and uses a compound indexed predicate based on bot, active status, enabled topic subscriptions, and a stable subscriber cursor. The service processes a configurable batch, such as 50 subscribers, and applies bounded concurrency rather than `Promise.all` over an entire audience.

Provider adapters classify:

- success;
- permanent blocked/chat-unavailable errors;
- retryable rate-limit errors, including `retry_after` when supplied;
- other transient failures;
- terminal validation/content failures.

For an MVP without a durable queue, the runner loops through bounded batches, pauses or defers on rate limits, caps attempts, and persists every result. The preferred production path is to enqueue dispatch IDs into the scheduler/queue once that infrastructure exists; dispatch rows remain the source of idempotency in either model.

### 10. Keep generic services provider-independent

Suggested service boundaries are:

- `SubscriberService`: private identity upsert, status transitions, and profile timestamps.
- `NotificationTopicService`: owner-authorized topic CRUD and ordering.
- `SubscriberPreferenceService`: list and toggle bot-scoped subscriptions.
- `SubscriberAudienceService`: paginated matching query.
- `SubscriberNotificationService`: occurrence creation, dispatch claiming, sending, retry classification, and history.
- `BotPlatformAdapter`: private post send/copy and normalized provider error classification.

Telegram webhook parsing remains provider-specific. Generic services receive normalized bot, sender, chat, command, callback, and send-result values.

## Dashboard Flow

1. Owner opens an owned bot and its Notifications page.
2. Server loader verifies session, platform, bot ownership, and requested filters.
3. Owner creates or manages active topics.
4. Post editor loads active topics from the same bot and saves associations transactionally.
5. Campaign editor allows subscriber notification only as an optional addition to the existing public destination.
6. Subscriber and delivery tabs query paginated bot-scoped data and never accept an unverified child resource as the ownership root.

## Webhook Flow

1. Provider webhook resolves and authenticates the bot.
2. Private `/start` upserts subscriber metadata and sends onboarding.
3. Topic commands render an inline keyboard from active bot topics and current enabled subscriptions.
4. Callback actions are parsed with an allowlist, resolved by bot-scoped `callbackKey`, sender-checked, and applied atomically.
5. `/stop` marks the subscriber unsubscribed and confirms the state.
6. Non-subscriber commands continue through the owner-only dispatcher.

## Campaign Sending Flow

The campaign runner retains the current public send as its first-class behavior. Subscriber delivery is a separate phase guarded by `notifySubscribers`, active post topics, and a logical occurrence key. Matching subscriber IDs are paginated, dispatch rows are established before sends, and each result is persisted. Aggregate subscriber counts can be reported without changing the existing public campaign result.

## Error Handling

- Validation and ownership errors fail before database mutation.
- Malformed callbacks are acknowledged safely and logged without sensitive payloads.
- Topic races use unique constraints and transactional upserts.
- A provider blocked error marks both dispatch and subscriber `BLOCKED`.
- A retryable error retains one dispatch row and records bounded attempt metadata.
- Content/provider validation errors become terminal `FAILED` results.
- One subscriber failure does not abort the remaining batch or undo public delivery.
- Stored `errorLog` values are length-limited and sanitized of tokens, authorization headers, and unnecessary personal data.

## Security / Ownership Model

- Dashboard access begins with the authenticated user and an owned bot filtered by platform.
- Topic, subscriber, post, campaign, and dispatch IDs are never authorized independently of that bot.
- Telegram callback identity comes from the signed webhook update context, not callback data.
- Topic callbacks resolve only within the current bot and current private subscriber.
- Subscriber commands expose preference operations only; owner commands retain current owner identity checks.
- Bot tokens never appear in URLs presented to users, logs, callback data, or dashboard responses.
- Subscriber data is personal data and should follow existing account deletion and retention policy; deletion policy must be documented before production rollout.

## Risks / Trade-offs

- [No scheduler exists] -> Implement the dispatch service behind an explicit runner contract and integrate it when scheduler infrastructure is added; test it independently in the meantime.
- [Multiple public campaign rows can duplicate private sends] -> Share a logical audience key and occurrence key, and enforce one unique dispatch key per subscriber.
- [A worker can crash after provider success but before marking `SENT`] -> Prefer provider message identifiers when available and retain a narrow reconciliation/manual-review path; database idempotency prevents concurrent duplicates but cannot provide exactly-once delivery across an external API boundary.
- [Telegram callback payload limits] -> Use short opaque bot-scoped callback keys and strict parsing.
- [Large audiences can exceed process or provider limits] -> Use indexed keyset pagination, bounded batches, bounded concurrency, and persisted retry state.
- [Owner-only webhook behavior could be weakened] -> Keep subscriber commands in a separate allowlisted dispatcher and leave management commands behind the existing owner check.
- [Topic deactivation changes audience size] -> Resolve active topics at execution time and show campaign warnings/history so owners can understand skipped subscriber phases.
- [Subscriber personal data increases compliance scope] -> Minimize stored fields, protect dashboard access, sanitize logs, and define retention/deletion behavior before launch.

## Migration Plan

1. Add enums, tables, indexes, relations, `Campaign.notifySubscribers` with default `false`, and optional logical audience key.
2. Generate and review the Prisma migration, verifying existing campaign rows require no backfill and retain `false`.
3. Deploy read/write services and owner-authorized dashboard endpoints with subscriber sending disabled by configuration.
4. Deploy Telegram private command and callback handling while preserving owner-only command routing.
5. Enable topic assignment and campaign opt-in UI for internal/test bots.
6. Deploy the batch dispatch service and connect it to controlled manual execution and the future campaign runner.
7. Verify idempotency, blocked-user handling, rate limits, and public-campaign regression behavior before broader enablement.

Rollback disables the feature flag and subscriber execution first. The additive tables and campaign columns can remain without affecting public campaigns. A destructive schema rollback is unnecessary and should be avoided until data retention decisions are made.

## Future Extension Path

Saved searches can be added later as another bot-scoped preference type whose matcher produces subscriber IDs through the same audience and dispatch services. A Mini App can call the same preference APIs instead of replacing the model. New providers can implement normalized private-send and error-classification adapter methods while retaining the shared subscriber/topic/dispatch schema. A future generalized campaign-target model can represent connected chats and subscriber audiences explicitly, but this change deliberately keeps the current `chatId` path intact.

## Open Questions

- Confirm the desired retention period and deletion behavior for subscriber personal data and dispatch history.
- Confirm whether a successful `/start` after `/stop` should reactivate immediately, as proposed, or require a separate confirmation button.
- Confirm the initial Telegram batch size, concurrency, retry cap, and operational rate-limit settings during implementation testing.
- Determine which future scheduler/queue owns recurring occurrence IDs; until then, the runner contract must receive a stable scheduled occurrence timestamp or operation ID.
- Verify Bale's private command, callback, blocked-user, and rate-limit semantics before enabling this capability for Bale bots.
