function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const subscriberNotificationConfig = {
  enabled: process.env.SUBSCRIBER_NOTIFICATIONS_ENABLED !== "false",
  batchSize: positiveInteger(
    process.env.SUBSCRIBER_NOTIFICATION_BATCH_SIZE,
    50,
  ),
  concurrency: positiveInteger(
    process.env.SUBSCRIBER_NOTIFICATION_CONCURRENCY,
    4,
  ),
  retryLimit: positiveInteger(
    process.env.SUBSCRIBER_NOTIFICATION_RETRY_LIMIT,
    3,
  ),
  claimLeaseMs: positiveInteger(
    process.env.SUBSCRIBER_NOTIFICATION_CLAIM_LEASE_MS,
    5 * 60 * 1000,
  ),
} as const;
