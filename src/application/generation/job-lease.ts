import { Prisma, type GenerationJob, type GenerationStage, type PrismaClient } from "@prisma/client";
import { DomainError } from "@/src/domain/errors";

export const GENERATION_LEASE_MS = 90_000;
export const GENERATION_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 30_000;

export async function claimNextGenerationJob(prisma: PrismaClient, workerId: string): Promise<GenerationJob | null> {
  const expiredAt = new Date();
  await prisma.generationJob.updateMany({
    where: { state: "RUNNING", leaseExpiresAt: { lte: expiredAt }, attemptCount: { gte: GENERATION_MAX_ATTEMPTS } },
    data: {
      state: "FAILED",
      errorCode: "GENERATION_IN_PROGRESS",
      errorMessage: "生成任务多次失去 Worker 心跳，已停止自动重试。",
      completedAt: expiredAt,
      leaseOwner: null,
      leaseExpiresAt: null,
      activeInputKey: null,
    },
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const claimTime = new Date();
    const candidate = await prisma.generationJob.findFirst({
      where: {
        attemptCount: { lt: GENERATION_MAX_ATTEMPTS },
        OR: [
          { state: "QUEUED", nextAttemptAt: { lte: claimTime } },
          { state: "RUNNING", leaseExpiresAt: { lte: claimTime } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!candidate) return null;
    const claimed = await prisma.generationJob.updateMany({
      where: {
        id: candidate.id,
        attemptCount: { lt: GENERATION_MAX_ATTEMPTS },
        OR: [
          { state: "QUEUED", nextAttemptAt: { lte: claimTime } },
          { state: "RUNNING", leaseExpiresAt: { lte: claimTime } },
        ],
      },
      data: {
        state: "RUNNING",
        leaseOwner: workerId,
        leaseExpiresAt: new Date(Date.now() + GENERATION_LEASE_MS),
        heartbeatAt: claimTime,
        startedAt: candidate.startedAt ?? claimTime,
        attemptCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
        errorDetails: Prisma.DbNull,
      },
    });
    if (claimed.count === 1) {
      return prisma.generationJob.findUnique({ where: { id: candidate.id } });
    }
  }
  return null;
}

export async function renewGenerationLease(prisma: PrismaClient, jobId: string, workerId: string): Promise<boolean> {
  const renewed = await prisma.generationJob.updateMany({
    where: { id: jobId, state: "RUNNING", leaseOwner: workerId },
    data: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + GENERATION_LEASE_MS) },
  });
  return renewed.count === 1;
}

export async function updateGenerationProgress(
  prisma: PrismaClient,
  jobId: string,
  workerId: string,
  stage: GenerationStage,
  progress: unknown,
  previewMarkdown?: string,
): Promise<void> {
  const updated = await prisma.generationJob.updateMany({
    where: { id: jobId, state: "RUNNING", leaseOwner: workerId },
    data: {
      stage,
      progressJson: progress as Prisma.InputJsonValue,
      ...(previewMarkdown === undefined ? {} : { previewMarkdown }),
    },
  });
  if (updated.count !== 1) {
    throw new DomainError("GENERATION_IN_PROGRESS", "生成任务租约已由其他 Worker 接管。", { retryable: true });
  }
}

export function generationRetryDelayMs(attemptCount: number, random = Math.random): number {
  const base = RETRY_BASE_DELAY_MS * (attemptCount <= 1 ? 1 : 4);
  const jitter = 0.8 + Math.min(1, Math.max(0, random())) * 0.4;
  return Math.round(base * jitter);
}

export function shouldRetryGeneration(retryable: boolean, attemptCount: number, leaseLost: boolean): boolean {
  return retryable && !leaseLost && attemptCount < GENERATION_MAX_ATTEMPTS;
}
