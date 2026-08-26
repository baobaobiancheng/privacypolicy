function integerFromEnvironment(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export const runtimeConfig = {
  get databaseConnectionLimit(): number {
    return integerFromEnvironment("DATABASE_CONNECTION_LIMIT", 5, 1, 50);
  },
  get databaseAcquireTimeoutMs(): number {
    return integerFromEnvironment("DATABASE_ACQUIRE_TIMEOUT_MS", 10_000, 1_000, 120_000);
  },
  get analyticsSummaryCacheTtlMs(): number {
    return integerFromEnvironment("ANALYTICS_SUMMARY_CACHE_TTL_MS", 30_000, 0, 300_000);
  },
};
