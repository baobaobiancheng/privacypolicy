import { analyticsBatchLimit } from "./config";

const WINDOW_MS = 60_000;

export { analyticsBatchLimit } from "./config";

export type TenantRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class TenantAnalyticsRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  check(
    tenantId: string,
    now = Date.now(),
    limit = analyticsBatchLimit(),
  ): TenantRateLimitResult {
    const threshold = now - WINDOW_MS;
    const hits = (this.buckets.get(tenantId) ?? []).filter((timestamp) => timestamp > threshold);

    if (hits.length >= limit) {
      this.buckets.set(tenantId, hits);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((hits[0] + WINDOW_MS - now) / 1_000)),
      };
    }

    hits.push(now);
    this.buckets.set(tenantId, hits);
    this.pruneExpiredBuckets(threshold);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  clear(): void {
    this.buckets.clear();
  }

  private pruneExpiredBuckets(threshold: number): void {
    if (this.buckets.size < 1_000) return;
    for (const [tenantId, hits] of this.buckets) {
      if (hits.every((timestamp) => timestamp <= threshold)) this.buckets.delete(tenantId);
    }
  }
}

export const tenantAnalyticsRateLimiter = new TenantAnalyticsRateLimiter();
