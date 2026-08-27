import { createHash } from "node:crypto";
import { Prisma, type GenerationStage, type PrismaClient } from "@prisma/client";
import { DomainError, isDomainError } from "@/src/domain/errors";
import { createEntityId } from "@/src/domain/ids";
import { GenerationInputSchema } from "@/src/workspace/form-adapter";
import { generatePolicyFromProjectFacts, type PolicyGeneratorResult, type PolicyGeneratorStage } from "./policy-generator";
import { MysqlReportStorage } from "@/src/storage/report-storage";
import { commitGenerationReport } from "./report-commit";
import {
  claimNextGenerationJob,
  GENERATION_LEASE_MS,
  generationRetryDelayMs,
  renewGenerationLease,
  shouldRetryGeneration,
  updateGenerationProgress,
} from "./job-lease";

export { generationRetryDelayMs } from "./job-lease";
export { enqueueGeneration, getGeneration, getLatestGenerationForRevision } from "./job-commands";
export type { GenerationJobView } from "./job-view";

const HEARTBEAT_MS = 20_000;
const PROGRESS_WRITE_INTERVAL_MS = 1_500;
const PREVIEW_WRITE_INTERVAL_MS = 5_000;
const PREVIEW_WRITE_CHARACTER_DELTA = 4_096;
const LEASE_ABORT_SAFETY_MS = 10_000;

export type GenerationWorkerDependencies = {
  generatePolicy?: typeof generatePolicyFromProjectFacts;
  /** Allows deterministic lease-loss tests without waiting for production heartbeat intervals. */
  heartbeatMs?: number;
};

export async function processNextGenerationJob(
  prisma: PrismaClient,
  workerId: string,
  dependencies: GenerationWorkerDependencies = {},
): Promise<boolean> {
  const job = await claimNextGenerationJob(prisma, workerId);
  if (!job) return false;

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const executionController = new AbortController();
  let leaseValidUntil = Date.now() + GENERATION_LEASE_MS;
  let heartbeatRunning = false;
  let lastProgressWrite = 0;
  let lastPreviewWrite = 0;
  let lastPreviewLength = 0;
  let progressWriteQueue = Promise.resolve();
  let progressWriteError: unknown;
  const queueProgressWrite = (
    stage: GenerationStage,
    progress: unknown,
    previewMarkdown?: string,
  ) => {
    progressWriteQueue = progressWriteQueue
      .then(() => updateGenerationProgress(prisma, job.id, workerId, stage, progress, previewMarkdown))
      .catch((error) => {
        progressWriteError ??= error;
        if (!executionController.signal.aborted) executionController.abort(error);
      });
    return progressWriteQueue;
  };
  const flushProgressWrites = async () => {
    await progressWriteQueue;
    if (progressWriteError) throw progressWriteError;
  };
  try {
    heartbeat = setInterval(() => {
      if (heartbeatRunning || executionController.signal.aborted) return;
      heartbeatRunning = true;
      void renewGenerationLease(prisma, job.id, workerId)
        .then((renewed) => {
          if (!renewed) {
            executionController.abort(new DomainError("GENERATION_IN_PROGRESS", "生成任务租约已由其他 Worker 接管。", { retryable: true }));
            return;
          }
          leaseValidUntil = Date.now() + GENERATION_LEASE_MS;
        })
        .catch((error) => {
          console.error(JSON.stringify({ level: "error", event: "generation_heartbeat_failed", jobId: job.id, error: String(error) }));
          if (Date.now() >= leaseValidUntil - LEASE_ABORT_SAFETY_MS && !executionController.signal.aborted) {
            executionController.abort(new DomainError("DATABASE_UNAVAILABLE", "无法续约生成任务，已停止本次执行。", { retryable: true }));
          }
        })
        .finally(() => {
          heartbeatRunning = false;
        });
    }, dependencies.heartbeatMs ?? HEARTBEAT_MS);

    const input = GenerationInputSchema.parse(job.inputJson);
    const reportId = createEntityId("rpt");
    const generatePolicy = dependencies.generatePolicy ?? generatePolicyFromProjectFacts;
    const result: PolicyGeneratorResult = await generatePolicy(reportId, input.formData, input.categoryKey, {
      onStage: async (stage, message) => {
        await queueProgressWrite(stageToDatabase(stage), { message });
        await flushProgressWrites();
      },
      onProgress: (progress) => {
        const now = Date.now();
        const force = progress.phase === "VALIDATED";
        const progressDue = force || now - lastProgressWrite >= PROGRESS_WRITE_INTERVAL_MS;
        const previewDue = force
          || now - lastPreviewWrite >= PREVIEW_WRITE_INTERVAL_MS
          || progress.previewMarkdown.length - lastPreviewLength >= PREVIEW_WRITE_CHARACTER_DELTA;
        if (!progressDue && !previewDue) return;
        lastProgressWrite = now;
        if (previewDue) {
          lastPreviewWrite = now;
          lastPreviewLength = progress.previewMarkdown.length;
        }
        void queueProgressWrite("DRAFTING", progress, previewDue ? progress.previewMarkdown : undefined);
      },
      signal: executionController.signal,
      acknowledgedPreflightIssues: input.acknowledgedPreflightIssues,
      preflightRound: input.preflightRound,
      cachedPreflight: input.cachedPreflight,
    });
    await flushProgressWrites();
    executionController.signal.throwIfAborted();
    const docxHash = `sha256:${createHash("sha256").update(result.docx).digest("hex")}`;
    const storage = new MysqlReportStorage(prisma);
    const stored = await storage.prepare(reportId, result.docx, docxHash);
    executionController.signal.throwIfAborted();

    await commitGenerationReport({ prisma, job, workerId, reportId, result, stored });
  } catch (error) {
    const domainError = isDomainError(error)
      ? error
      : new DomainError("DOCX_GENERATION_FAILED", "隐私政策生成失败。", { retryable: true });
    const leaseLost = executionController.signal.aborted
      && executionController.signal.reason instanceof DomainError
      && executionController.signal.reason.code === "GENERATION_IN_PROGRESS";
    const retry = shouldRetryGeneration(domainError.retryable, job.attemptCount, leaseLost);
    const nextAttemptAt = retry ? new Date(Date.now() + generationRetryDelayMs(job.attemptCount)) : new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.generationJob.updateMany({ where: { id: job.id, leaseOwner: workerId }, data: {
        state: retry ? "QUEUED" : "FAILED",
        errorCode: domainError.code,
        errorMessage: domainError.message,
        errorDetails: domainError.details
          ? domainError.details as Prisma.InputJsonValue
          : Prisma.DbNull,
        completedAt: retry ? null : new Date(),
        nextAttemptAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        ...(retry ? {} : { activeInputKey: null }),
      } });
      if (updated.count === 1) {
        await tx.auditEvent.create({ data: {
          id: createEntityId("aud"), projectId: job.projectId, userId: job.requestedById,
          action: retry ? "GENERATION_REQUEUED" : "GENERATION_FAILED",
          metadata: { generationId: job.id, attemptCount: job.attemptCount, errorCode: domainError.code },
        } });
      }
    });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (!executionController.signal.aborted) executionController.abort();
  }
  return true;
}

function stageToDatabase(stage: PolicyGeneratorStage): GenerationStage {
  return stage;
}
