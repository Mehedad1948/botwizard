## 1. Data Model and Migration

- [x] 1.1 Add `SubscriberStatus` and `NotificationDispatchStatus` enums to the Prisma schema.
- [x] 1.2 Add `BotSubscriber` with platform-neutral identity fields, bot-scoped uniqueness, timestamps, status, and matching indexes.
- [x] 1.3 Add `NotificationTopic` with bot-scoped slug and compact callback-key uniqueness, activation, ordering, and indexes.
- [x] 1.4 Add `SubscriberTopicSubscription` and `PostNotificationTopic` join models with unique constraints, ownership-compatible relations, and matching indexes.
- [x] 1.5 Add `SubscriberNotificationDispatch` with occurrence-aware `dispatchKey`, status, attempts, sanitized error, timestamps, relations, and query indexes.
- [x] 1.6 Add subscriber/topic/dispatch relations to `Bot`, `Post`, and `Campaign`, plus `Campaign.notifySubscribers @default(false)` and the optional logical subscriber audience key.
- [x] 1.7 Generate and review an additive Prisma migration, verifying existing campaigns retain their `chatId` behavior and default to subscriber notification disabled.
- [ ] 1.8 Regenerate Prisma Client and verify the migration applies cleanly to an empty database and a database containing existing campaigns.

## 2. Shared Domain and Provider Contracts

- [x] 2.1 Define normalized private-subscriber update, callback, send-result, and provider-error types without embedding Telegram-specific names in shared services.
- [x] 2.2 Extend the bot platform adapter contract with private post delivery/copy support and blocked, rate-limited, transient, and terminal error classification.
- [x] 2.3 Implement Telegram private post delivery by reusing existing post text/media behavior and returning normalized message/error results.
- [x] 2.4 Add configuration for subscriber batch size, bounded concurrency, retry cap, and feature enablement with conservative defaults.

## 3. Subscriber and Topic Services

- [x] 3.1 Implement `SubscriberService` upsert for private `/start`, including profile metadata, start parameter, timestamps, and explicit reactivation behavior.
- [x] 3.2 Implement subscriber status transitions for unsubscribe, blocked-provider outcomes, and successful re-entry.
- [x] 3.3 Implement owner-authorized topic list/create/update/activate/deactivate/reorder operations with normalized bot-scoped slugs.
- [x] 3.4 Generate short opaque topic callback keys and resolve them only within the receiving bot.
- [x] 3.5 Implement safe topic deletion that hard-deletes only unreferenced topics and otherwise requires deactivation.
- [x] 3.6 Implement transactional preference listing and toggle/upsert operations scoped by bot, subscriber, sender, and active topic.

## 4. Telegram Subscriber Webhook Flow

- [x] 4.1 Add a private subscriber-command dispatcher that recognizes only `/start`, `/topics`, `/notify`, `/settings`, and `/stop`.
- [x] 4.2 Route recognized private subscriber commands before the existing owner-only management dispatcher without weakening owner authorization.
- [x] 4.3 Parse and validate optional `/start` parameters and return onboarding text plus a topic-selection action.
- [x] 4.4 Render active topics and current enabled states as an inline keyboard for `/topics`, `/notify`, and `/settings`.
- [x] 4.5 Implement strict parsing for `topic:toggle:<callbackKey>`, `topic:list`, and `topic:stop` callback actions.
- [x] 4.6 Verify callback bot scope, private chat, subscriber existence, sender identity, topic ownership, and active state before mutation.
- [x] 4.7 Implement `/stop` and inline stop confirmation while retaining historical subscriptions and dispatch records.
- [x] 4.8 Add localized responses for no topics, unsubscribed state, malformed callbacks, expired topics, and successful preference changes.
- [x] 4.9 Confirm group/channel updates and arbitrary private messages do not create subscribers or gain access to owner commands.

## 5. Dashboard Notifications Area

- [x] 5.1 Add `/dashboard/[platform]/bots/[botId]/notifications` under the existing bot detail navigation.
- [x] 5.2 Build server-side ownership loaders that resolve session, platform, and owned bot before loading any topic, subscriber, or dispatch child resource.
- [x] 5.3 Add topic management UI for create, edit, activate/deactivate, safe delete, and optional simple ordering.
- [x] 5.4 Add a paginated subscriber list with status/topic filters and search by username, name, or platform user ID.
- [x] 5.5 Show subscriber status, first-seen time, last interaction, and enabled topics with clear empty and loading states.
- [x] 5.6 Add paginated delivery-history views with post/campaign context, status filters, attempt metadata, sent time, and sanitized errors.
- [x] 5.7 Apply the existing platform dashboard theme and responsive patterns to desktop and mobile notification views.

## 6. Post and Campaign Integration

- [x] 6.1 Add bot-scoped active-topic loading and multi-topic selection to post create/edit flows.
- [x] 6.2 Save post-topic associations transactionally and reject topics that do not belong to the post's bot.
- [x] 6.3 Add the `Notify matching subscribers` control to campaign create/edit flows with default disabled.
- [x] 6.4 Show the required consent warning and a validation warning when notification is enabled for a post with no active topics.
- [x] 6.5 Generate or propagate a logical subscriber audience key when one owner action creates sibling campaign rows for multiple connected chats.
- [x] 6.6 Preserve all existing single-`chatId` campaign forms, validation, scheduling fields, and public delivery behavior.

## 7. Audience Matching and Dispatch

- [x] 7.1 Implement an indexed, keyset-paginated audience query for active subscribers with at least one enabled subscription matching an active post topic.
- [x] 7.2 Deduplicate subscribers matched through multiple topics and exclude subscribers belonging to another bot.
- [x] 7.3 Define stable campaign occurrence keys for one-time, recurring, retry, and controlled manual executions.
- [x] 7.4 Build `SubscriberNotificationService` to create or load one dispatch row before provider I/O using the unique logical dispatch key.
- [x] 7.5 Add transactional dispatch claiming so concurrent workers cannot intentionally process the same pending dispatch.
- [x] 7.6 Process dispatches in bounded batches and concurrency, updating attempts and terminal or retryable statuses per subscriber.
- [x] 7.7 Honor provider `retry_after` data and retry only classified transient failures without inserting a second dispatch.
- [x] 7.8 Mark blocked/chat-unavailable dispatches `BLOCKED`, update subscriber status, and continue processing the batch.
- [x] 7.9 Sanitize and length-limit stored provider errors so credentials and unnecessary personal data are never persisted.

## 8. Campaign Runner Integration

- [x] 8.1 Add an explicit campaign-run subscriber phase after or alongside the unchanged public connected-chat send.
- [x] 8.2 Return immediately without subscriber queries or dispatch rows when `notifySubscribers` is false.
- [x] 8.3 Produce a skipped subscriber-phase result when notification is enabled but the post has no active topics.
- [x] 8.4 Ensure public delivery success is not rolled back or repeated because subscriber delivery partially fails.
- [x] 8.5 Ensure sibling public campaign rows converge on one logical subscriber notification per occurrence.
- [x] 8.6 Expose a controlled manual/test runner entry point until the project has an operational scheduler or durable queue.
- [x] 8.7 Document the integration contract the future scheduler/queue must use for stable occurrence IDs, retries, and dispatch claiming.

## 9. Automated Verification

- [ ] 9.1 Add a project test harness suitable for isolated service tests and database-backed integration tests.
- [ ] 9.2 Test `/start` create/update/reactivation behavior, start parameters, private-chat enforcement, and the group-member boundary.
- [ ] 9.3 Test topic CRUD uniqueness, callback-key resolution, safe deletion, activation, and cross-bot rejection.
- [ ] 9.4 Test preference commands, secure callback parsing, sender mismatch, topic toggle idempotency, and `/stop`.
- [ ] 9.5 Test owner authorization for topic, subscriber, post-topic, campaign, and dispatch-history operations.
- [ ] 9.6 Test post topic assignment and rejection of a topic from another bot, including another bot owned by the same user.
- [ ] 9.7 Test matching semantics for one topic, multiple topics, inactive topics, disabled subscriptions, unsubscribed users, blocked users, and foreign bots.
- [ ] 9.8 Test dispatch uniqueness under retries and concurrent claims for one-time and recurring campaign occurrences.
- [ ] 9.9 Test sibling public campaigns do not create duplicate private notifications for one logical occurrence.
- [ ] 9.10 Test provider success, blocked, rate-limited, transient, and terminal failures with persisted status and retry metadata.
- [ ] 9.11 Add regression tests proving existing campaigns remain public-only by default and retain their current `chatId` delivery behavior.
- [ ] 9.12 Run Prisma validation/generation, migration checks, the new test suite, `npm run lint`, and `npm run build`.

## 10. Documentation, Rollout, and Manual QA

- [x] 10.1 Document subscriber consent boundaries, supported Telegram commands, topic matching semantics, unsubscribe/reactivation behavior, and owner dashboard usage.
- [x] 10.2 Document subscriber personal-data fields, retention/deletion policy, dispatch-history retention, and operator access expectations.
- [x] 10.3 Document environment settings, batch/retry tuning, feature rollout, and the scheduler/queue integration gap.
- [ ] 10.4 Seed or create a Telegram test bot with active/inactive topics and subscribers in active, unsubscribed, and blocked states.
- [ ] 10.5 Manually verify onboarding, inline topic toggles, settings aliases, unsubscribe, reactivation, malformed callbacks, and cross-user callback rejection.
- [ ] 10.6 Manually verify a campaign sends publicly with notification disabled and sends one private copy only to matching active subscribers when enabled.
- [ ] 10.7 Manually verify media/text fidelity, multiple-topic deduplication, multiple-public-destination deduplication, blocked-user handling, and retry behavior.
- [ ] 10.8 Roll out behind a feature flag to internal/test bots, monitor dispatch status/error rates, and enable broader access only after regression checks pass.
