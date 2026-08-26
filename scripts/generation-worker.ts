import { hostname } from "node:os";
import { getPrisma } from "../src/data/prisma";
import { processNextGenerationJob } from "../src/application/generation/job-service";
import { purgeExpiredAnalyticsEvents } from "../src/analytics/retention";

const POLL_MS = Number(process.env.GENERATION_WORKER_POLL_MS ?? 1_500);
const ANALYTICS_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const workerId = `${hostname()}:${process.pid}`;
let stopping = false;
let nextAnalyticsCleanupAt = 0;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

async function main(): Promise<void> {
  const prisma = getPrisma();
  console.info(JSON.stringify({ level: "info", event: "generation_worker_started", workerId }));
  while (!stopping) {
    const processed = await processNextGenerationJob(prisma, workerId).catch((error) => {
      console.error(JSON.stringify({ level: "error", event: "generation_worker_loop_failed", workerId, error: String(error) }));
      return false;
    });
    // 清理只占用空闲轮次，并且每轮只删除一批；下一轮先重新检查生成队列。
    let cleanupHasMore = false;
    if (!processed && Date.now() >= nextAnalyticsCleanupAt) {
      const cleanup = await purgeExpiredAnalyticsEvents(prisma, { maxBatches: 1 }).catch((error) => {
        console.error(JSON.stringify({ level: "error", event: "analytics_retention_cleanup_failed", workerId, error: String(error) }));
        return null;
      });
      cleanupHasMore = cleanup?.hasMore ?? false;
      nextAnalyticsCleanupAt = Date.now() + (cleanupHasMore ? 0 : ANALYTICS_CLEANUP_INTERVAL_MS);
      if (cleanup) {
        console.info(JSON.stringify({
          level: "info",
          event: "analytics_retention_cleanup_completed",
          workerId,
          cutoff: cleanup.cutoff.toISOString(),
          deleted: cleanup.deleted,
          batches: cleanup.batches,
          hasMore: cleanup.hasMore,
        }));
      }
    }
    if (!processed && !cleanupHasMore) await delay(POLL_MS);
  }
  await prisma.$disconnect();
  console.info(JSON.stringify({ level: "info", event: "generation_worker_stopped", workerId }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", event: "generation_worker_crashed", workerId, error: String(error) }));
  process.exitCode = 1;
});
