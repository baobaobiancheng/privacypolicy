function positiveInteger(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function analyticsBatchLimit(value = process.env.ANALYTICS_RATE_LIMIT_BATCHES_PER_MINUTE): number {
  return positiveInteger(value, 120);
}

export function analyticsRetentionDays(value = process.env.ANALYTICS_RETENTION_DAYS): number {
  return positiveInteger(value, 180);
}

export function analyticsRetentionBatchSize(value = process.env.ANALYTICS_RETENTION_BATCH_SIZE): number {
  return positiveInteger(value, 1_000);
}
