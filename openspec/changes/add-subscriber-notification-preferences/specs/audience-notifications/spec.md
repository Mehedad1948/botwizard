## ADDED Requirements

### Requirement: Private interaction establishes subscriber identity
The system SHALL create a `BotSubscriber` only from a supported private interaction with that specific bot and SHALL NOT infer subscribers from group or channel membership.

#### Scenario: Subscriber creation on `/start`
- **WHEN** a Telegram user sends `/start` to a bot in a private chat
- **THEN** the system SHALL upsert a subscriber identified by that bot and platform user ID, store the private chat and available profile metadata, mark the subscriber active, record the interaction timestamps and optional start parameter, and return onboarding text with a topic-selection action

#### Scenario: Existing subscriber starts again
- **WHEN** a previously unsubscribed or blocked user successfully sends `/start` in the bot's private chat
- **THEN** the system SHALL update the existing subscriber instead of creating a duplicate and SHALL restore the subscriber to `ACTIVE` without automatically enabling topics the user did not select

#### Scenario: Group member is not a subscriber
- **WHEN** the bot observes a user only through a group or channel update
- **THEN** the system SHALL NOT create a `BotSubscriber` for that user

### Requirement: Owners manage bot-scoped notification topics
The system SHALL allow an authenticated owner to create, view, update, activate, deactivate, and safely remove notification topics only for a bot they own.

#### Scenario: Topic creation by owner
- **WHEN** an authenticated owner creates a topic with a valid name for an owned bot
- **THEN** the system SHALL create a bot-scoped topic with a normalized slug unique within that bot and make it available for subscriber selection when active

#### Scenario: Same slug on different bots
- **WHEN** two owned bots define topics with the same slug
- **THEN** the system SHALL allow both topics because topic slug uniqueness is scoped to a bot

#### Scenario: Referenced topic deletion
- **WHEN** an owner requests deletion of a topic referenced by subscriptions, posts, or delivery history
- **THEN** the system SHALL preserve referential integrity by deactivating the topic or rejecting hard deletion with a clear instruction to deactivate it

### Requirement: Subscribers manage preferences with private commands
The system SHALL make `/topics`, `/notify`, and `/settings` display the active topics for the current bot and the current subscriber's enabled preferences.

#### Scenario: Subscriber opens topic settings
- **WHEN** an active subscriber sends `/topics`, `/notify`, or `/settings` in the bot's private chat
- **THEN** the system SHALL return the same topic-preference interface with inline controls showing enabled and disabled states

#### Scenario: No active topics
- **WHEN** a subscriber opens topic settings for a bot that has no active topics
- **THEN** the system SHALL return a localized empty state and SHALL NOT expose inactive topics as selectable

### Requirement: Inline topic callbacks are compact and securely scoped
The system SHALL encode topic actions in compact, parseable callback data and SHALL validate the bot, subscriber, sender, action, and topic before changing a preference.

#### Scenario: Subscriber topic toggle
- **WHEN** the Telegram user who owns a private subscriber record activates a valid toggle button for an active topic belonging to the same bot
- **THEN** the system SHALL atomically create or update the subscriber-topic record, invert its enabled state, acknowledge the callback, and refresh the displayed preference state

#### Scenario: Cross-bot topic callback
- **WHEN** callback data references a topic that does not belong to the bot receiving the callback
- **THEN** the system SHALL reject the mutation without revealing topic data or changing any subscription

#### Scenario: Callback sender mismatch
- **WHEN** the callback sender's platform user ID does not match the referenced subscriber
- **THEN** the system SHALL reject the mutation and record a security-relevant diagnostic without exposing another subscriber's preferences

#### Scenario: Malformed callback data
- **WHEN** callback data is malformed, unsupported, expired, or cannot be resolved within the current bot
- **THEN** the system SHALL safely acknowledge or reject the callback and SHALL NOT perform a preference mutation

### Requirement: Subscribers can stop private notifications
The system SHALL support `/stop` and the equivalent inline stop action as explicit unsubscribe operations.

#### Scenario: Subscriber unsubscribes
- **WHEN** a subscriber sends `/stop` or confirms the inline stop action
- **THEN** the system SHALL set the subscriber status to `UNSUBSCRIBED`, preserve historical preferences and delivery records, and confirm that future private notifications are disabled

#### Scenario: Unsubscribed subscriber opens settings
- **WHEN** an unsubscribed subscriber opens topic settings
- **THEN** the system SHALL explain that notifications are disabled and SHALL require an explicit reactivation action before future private delivery

### Requirement: Owners assign notification topics to posts
The system SHALL allow an authenticated owner to assign zero or more active topics from the post's bot to an owned post.

#### Scenario: Assigning topics to a post
- **WHEN** an owner saves a post with selected topics that belong to the same owned bot
- **THEN** the system SHALL replace the post's topic associations transactionally and SHALL prevent duplicate post-topic associations

#### Scenario: Topic from another bot
- **WHEN** an owner attempts to attach a topic from another bot to a post
- **THEN** the system SHALL reject the request even if the owner also owns the other bot

### Requirement: Subscriber notification is an optional campaign path
The system SHALL preserve the existing connected-chat campaign path and SHALL execute subscriber notification only when `notifySubscribers` is enabled.

#### Scenario: Sending campaign to connected chat only
- **WHEN** an existing or new campaign runs with subscriber notification disabled
- **THEN** the system SHALL send the post to its configured `chatId` using the existing behavior and SHALL create no subscriber notification dispatches

#### Scenario: Notification enabled without post topics
- **WHEN** a campaign is configured to notify subscribers but its post has no active notification topics
- **THEN** the system SHALL send the existing public destination normally, send no private notifications, and expose a validation warning or skipped notification outcome

#### Scenario: Public send succeeds and subscriber sends fail
- **WHEN** public connected-chat delivery succeeds but one or more subscriber deliveries fail
- **THEN** the system SHALL retain the successful public result and track subscriber failures independently without rolling back or repeating the public send

### Requirement: Campaigns notify matching subscribers
The system SHALL privately notify only active subscribers of the campaign bot who have at least one enabled subscription matching an active topic assigned to the campaign post.

#### Scenario: Sending campaign to matching subscribers
- **WHEN** a campaign occurrence has subscriber notification enabled and its post has active topics
- **THEN** the system SHALL send the post content or media privately to each active subscriber matching at least one selected topic and SHALL record the result per subscriber

#### Scenario: Subscriber matches multiple topics
- **WHEN** one subscriber matches more than one topic assigned to the post
- **THEN** the system SHALL create at most one private notification dispatch for that subscriber for the logical campaign occurrence

#### Scenario: Subscriber belongs to another bot
- **WHEN** a subscriber of another bot has an equivalent topic name or slug
- **THEN** the system SHALL NOT include that subscriber in the campaign audience

### Requirement: Unsubscribed and blocked subscribers are excluded
The system SHALL exclude subscribers whose status is not `ACTIVE` from private notification delivery.

#### Scenario: Skipping unsubscribed users
- **WHEN** an otherwise matching subscriber has status `UNSUBSCRIBED`
- **THEN** the system SHALL not call the provider send API for that subscriber

#### Scenario: Skipping blocked users
- **WHEN** an otherwise matching subscriber has status `BLOCKED`
- **THEN** the system SHALL not call the provider send API for that subscriber

### Requirement: Subscriber delivery is idempotent and retry-safe
The system SHALL use a durable unique dispatch identity for each logical campaign occurrence, post, and subscriber and SHALL update the same dispatch record during retries.

#### Scenario: Avoiding duplicate dispatch
- **WHEN** the same campaign occurrence is executed or retried more than once for the same post and subscriber
- **THEN** the system SHALL create no second dispatch record and SHALL not repeat a delivery already marked `SENT`

#### Scenario: Recurring campaign reaches a new occurrence
- **WHEN** the same recurring campaign reaches a later scheduled occurrence
- **THEN** the system SHALL use a distinct occurrence identity and MAY send a new notification while still deduplicating retries within that occurrence

#### Scenario: One logical campaign has multiple public destinations
- **WHEN** multiple single-`chatId` campaign records represent one logical campaign notification run
- **THEN** the system SHALL share a subscriber audience/run identity or designate one subscriber-dispatch owner so a subscriber receives at most one private notification for that logical occurrence

### Requirement: Subscriber delivery scales through bounded batches
The system SHALL select and process matching subscribers in deterministic bounded batches and SHALL NOT load an unbounded bot audience into application memory.

#### Scenario: Large matching audience
- **WHEN** the number of matching subscribers exceeds the configured batch size
- **THEN** the system SHALL continue with keyset or cursor pagination, bounded send concurrency, and provider-aware rate-limit handling until the run completes or is safely deferred

#### Scenario: Rate limit response
- **WHEN** the provider returns a retryable rate-limit response
- **THEN** the system SHALL retain the existing dispatch identity, honor the provider retry delay when available, and retry without creating duplicate records

### Requirement: Provider failures update delivery and subscriber state
The system SHALL classify provider errors into permanent blocked-recipient outcomes and retryable or terminal delivery failures.

#### Scenario: Handling failed Telegram send
- **WHEN** Telegram rejects a private send for a transient or non-blocking reason
- **THEN** the system SHALL record the error safely, update the dispatch to a retryable or terminal `FAILED` state according to policy, and continue processing other subscribers

#### Scenario: Telegram user blocks the bot
- **WHEN** Telegram indicates that the subscriber blocked the bot or the private chat is no longer available
- **THEN** the system SHALL mark the dispatch `BLOCKED`, set the subscriber status to `BLOCKED`, and exclude that subscriber from future runs

### Requirement: Owners can inspect subscriber notification data
The system SHALL provide bot-scoped dashboard views for topic management, subscriber discovery, preference visibility, and delivery history.

#### Scenario: Filter subscriber list
- **WHEN** an owner filters an owned bot's subscriber list by topic, status, name, username, or platform user ID
- **THEN** the system SHALL return only matching subscribers of that bot with first-seen, last-interaction, status, and subscribed-topic information

#### Scenario: View notification delivery history
- **WHEN** an owner views notification history for an owned bot, post, or campaign
- **THEN** the system SHALL show authorized dispatch outcomes and sanitized error information without exposing credentials or another owner's data

### Requirement: Dashboard access enforces ownership
The system SHALL authorize every topic, subscriber, post-topic, campaign-notification, and dispatch-history action through the authenticated user's ownership of the associated bot.

#### Scenario: Preventing cross-owner access
- **WHEN** an authenticated user requests or mutates a subscriber, topic, post association, campaign setting, or dispatch belonging to another user's bot
- **THEN** the system SHALL deny the operation without returning the protected resource

#### Scenario: Platform route mismatch
- **WHEN** a dashboard request uses a platform route that does not match the owned bot's platform
- **THEN** the system SHALL reject or redirect the request and SHALL NOT execute the requested mutation

### Requirement: Existing campaign behavior remains compatible
The system SHALL apply database defaults and execution guards that leave all existing campaigns as public connected-chat campaigns until an owner explicitly enables subscriber notification.

#### Scenario: Existing campaign after migration
- **WHEN** a campaign created before this change runs after the database migration
- **THEN** the system SHALL retain its existing `chatId`, schedule, post, and public delivery behavior with subscriber notification disabled

#### Scenario: Existing public delivery implementation
- **WHEN** subscriber notification support is deployed
- **THEN** the system SHALL continue using the current connected-chat delivery path rather than replacing it with subscriber dispatch logic

