## ADDED Requirements

### Requirement: Campaigns publish one post to many destinations
The system SHALL let an owner create one campaign that delivers one post to one
or more destinations of the same bot, and SHALL manage its schedule, status and
history as a single unit.

#### Scenario: Multi-destination campaign
- **WHEN** an owner schedules a post to three connected channels
- **THEN** the system SHALL create exactly one campaign with three targets

#### Scenario: Foreign destination rejected
- **WHEN** a request targets a destination that belongs to another bot
- **THEN** the system SHALL reject the request without creating a campaign

### Requirement: Schedules support one-off, interval, daily and weekly rules
The system SHALL support `ONCE`, `INTERVAL` (≥ 60 minutes), `DAILY` and
`WEEKLY` schedules evaluated in the campaign timezone, with optional end date,
maximum runs and random jitter of up to 60 minutes.

#### Scenario: Daily times
- **WHEN** a daily campaign has times 09:00 and 18:30 in Asia/Tehran and it is 12:00 there
- **THEN** the next run SHALL be 18:30 Asia/Tehran today

#### Scenario: Completion
- **WHEN** a `ONCE` campaign runs, or a campaign reaches `maxRuns`, or its next run is after `endsAt`
- **THEN** the system SHALL mark it `COMPLETED` and SHALL NOT run it again

### Requirement: Scheduled occurrences are delivered exactly once per destination
The system SHALL process due campaigns from a secret-protected tick endpoint and
SHALL record one delivery per campaign, destination and occurrence.

#### Scenario: Concurrent ticks
- **WHEN** two ticks run at the same time
- **THEN** each destination SHALL receive the occurrence at most once

#### Scenario: Outage catch-up
- **WHEN** the scheduler was down across several occurrences
- **THEN** the system SHALL send one catch-up occurrence and schedule the next future run

#### Scenario: Unauthorised tick
- **WHEN** the tick endpoint is called without the configured secret
- **THEN** the system SHALL respond 401 and do nothing

### Requirement: Delivery failures are retried and explained
The system SHALL retry transient and rate-limited failures with backoff, SHALL
stop on terminal failures, and SHALL store a plain-language Persian explanation.

#### Scenario: Bot lost admin rights
- **WHEN** a delivery fails because the bot cannot post in a destination
- **THEN** the delivery SHALL be `FAILED` with a "give the bot posting rights" explanation and the destination SHALL be marked `NO_PERMISSION`

### Requirement: Content survives deletion of the source message
The system SHALL store media file identifiers, formatting entities and URL
buttons for captured or composed posts and SHALL send from stored data.

#### Scenario: Owner cleared the bot chat
- **WHEN** the owner deletes the original private message and a campaign runs
- **THEN** the post SHALL still be delivered with its media and formatting

### Requirement: Destination health is tracked
The system SHALL record destination type and health from membership updates and
delivery results, and SHALL skip non-active destinations.

#### Scenario: Bot removed from a group
- **WHEN** the platform reports the bot left or was removed from a chat
- **THEN** the destination SHALL be marked `REMOVED` regardless of who removed it

#### Scenario: Only the owner adds destinations
- **WHEN** someone other than the owner adds the bot to a chat
- **THEN** the system SHALL NOT add that chat as a destination

### Requirement: Owner bot conversation is safe
The system SHALL keep multi-step bot conversation state on the server, keep
callback data under 64 bytes, and verify that every referenced campaign, post
or destination belongs to the receiving bot.

#### Scenario: Many destinations selected in the bot
- **WHEN** the owner selects ten destinations in the bot
- **THEN** all ten SHALL be targeted by the resulting campaign

#### Scenario: Forged callback
- **WHEN** a callback references a campaign of another bot
- **THEN** the system SHALL reject it without changing data

### Requirement: Webhooks are authenticated
The system SHALL register new webhooks on an opaque per-bot URL and SHALL verify
the Telegram secret token header when the bot has a secret.

#### Scenario: Missing secret header
- **WHEN** a Telegram update arrives on the opaque URL without the correct secret header
- **THEN** the system SHALL respond 401 and not process it
