import type { PrismaClient } from "@prisma/client";
import { analyticsRetentionBatchSize, analyticsRetentionDays } from "./config";

export { analyticsRetentionBatchSize, analyticsRetentionDays } from "./config";

const DAY_MS = 24 * 60 * 60 * 1_000;

export type AnalyticsRetentionOptions = {
  retentionDays?: number;
  batchSize?: number;
  maxBatches?: number;
  now?: Date;
};

export type AnalyticsRetentionResult = {
  cutoff: Date;
  deleted: number;
  batches: number;
  hasMore: boolean;
};

export function analyticsRetentionCutoff(now = new Date(), retentionDays = analyticsRetentionDays()): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

export async function purgeExpiredAnalyticsEvents(
  prisma: Pick<PrismaClient, "analyticsEvent">,
  options: AnalyticsRetentionOptions = {},
): Promise<AnalyticsRetentionResult> {
  const retentionDays = options.retentionDays ?? analyticsRetentionDays();
  const batchSize = options.batchSize ?? analyticsRetentionBatchSize();
  const maxBatches = options.maxBatches ?? 100;
  const cutoff = analyticsRetentionCutoff(options.now, retentionDays);
  let deleted = 0;
  let batches = 0;
  let hasMore = false;

  while (batches < maxBatches) {
    const rows = await prisma.analyticsEvent.findMany({
      where: { occurredAt: { lt: cutoff } },
      select: { id: true },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: batchSize,
    });
    if (rows.length === 0) {
      hasMore = false;
      break;
    }

    const result = await prisma.analyticsEvent.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    deleted += result.count;
    batches += 1;
    hasMore = rows.length === batchSize;
    if (!hasMore) break;
  }

  return { cutoff, deleted, batches, hasMore };
}
