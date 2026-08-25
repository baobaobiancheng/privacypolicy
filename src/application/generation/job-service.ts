import { createHash } from "node:crypto";
import { Prisma, type GenerationJob, type GenerationStage, type PrismaClient } from "@prisma/client";
import { DomainError, isDomainError } from "@/src/domain/errors";
import { createEntityId } from "@/src/domain/ids";
import type { SessionActor } from "@/src/auth/session";
import { loadProject } from "@/src/data/project-repository";
import { ProjectFormDataSchema } from "@/src/workspace/contract";
import { GenerationInputSchema } from "@/src/workspace/form-adapter";
import { generatePolicyFromProjectFacts, type PolicyGeneratorResult, type PolicyGeneratorStage } from "./policy-generator";
import { MysqlReportStorage } from "@/src/storage/report-storage";

const LEASE_MS = 90_000;
const HEARTBEAT_MS = 20_000;
const MAX_ATTEMPTS = 3;

export type GenerationJobView = {
  id: string;
  projectId: string;
  projectRevision: number;
  state: GenerationJob["state"];
  stage: GenerationJob["stage"];
  progress: unknown;
  previewMarkdown: string | null;
  error: { code: string; message: string; details: unknown } | null;
  reportId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export async function enqueueGeneration(
  prisma: PrismaClient,
  actor: SessionActor,
  projectId: string,
  idempotencyKey: string,
  requestId?: string,
): Promise<{ job: GenerationJobView; reused: boolean }> {
  if (!idempotencyKey.trim() || idempotencyKey.length > 128) {
    throw new DomainError("FIELD_INVALID", "缺少有效的幂等键。", { retryable: false });
  }
  const project = await loadProject(actor, projectId, "EDIT", prisma);
  const formData = ProjectFormDataSchema.parse(project.formData);
  const input = GenerationInputSchema.parse({
    schemaVersion: formData.schemaVersion,
    projectRevision: project.revision,
    formData,
  });
  const inputHash = hashJson(input);
  const existing = await prisma.generationJob.findUnique({
    where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
    include: { report: { select: { id: true } } },
  });
  if (existing) {
    if (existing.inputHash !== inputHash) {
      throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已更新，请使用新的生成请求。", { retryable: true });
    }
    return { job: toJobView(existing), reused: true };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const job = await tx.generationJob.create({ data: {
        id: createEntityId("gen"),
        projectId,
        requestedById: actor.userId,
        projectRevision: project.revision,
        idempotencyKey,
        inputHash,
        inputJson: input as unknown as Prisma.InputJsonValue,
        progressJson: { completedSections: 0, totalSections: 8, characterCount: 0 },
      }, include: { report: { select: { id: true } } } });
      await tx.auditEvent.create({ data: {
        id: createEntityId("aud"), requestId, projectId, userId: actor.userId,
        action: "GENERATION_QUEUED", metadata: { generationId: job.id, projectRevision: project.revision, inputHash },
      } });
      return job;
    });
    return { job: toJobView(created), reused: false };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const concurrent = await prisma.generationJob.findUnique({
      where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
      include: { report: { select: { id: true } } },
    });
    if (!concurrent || concurrent.inputHash !== inputHash) {
      throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已更新，请使用新的生成请求。", { retryable: true });
    }
    return { job: toJobView(concurrent), reused: true };
  }
}

export async function getGeneration(
  prisma: PrismaClient,
  actor: SessionActor,
  projectId: string,
  generationId: string,
): Promise<GenerationJobView> {
  await loadProject(actor, projectId, "READ", prisma);
  const job = await prisma.generationJob.findFirst({
    where: { id: generationId, projectId },
    include: { report: { select: { id: true } } },
  });
  if (!job) throw new DomainError("GENERATION_NOT_FOUND", "生成任务不存在。", { retryable: false });
  return toJobView(job);
}

export type GenerationWorkerDependencies = {
  generatePolicy?: typeof generatePolicyFromProjectFacts;
};

export async function processNextGenerationJob(
  prisma: PrismaClient,
  workerId: string,
  dependencies: GenerationWorkerDependencies = {},
): Promise<boolean> {
  const job = await claimNextJob(prisma, workerId);
  if (!job) return false;

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lastProgressWrite = 0;
  try {
    heartbeat = setInterval(() => {
      void renewLease(prisma, job.id, workerId).catch((error) => {
        console.error(JSON.stringify({ level: "error", event: "generation_heartbeat_failed", jobId: job.id, error: String(error) }));
      });
    }, HEARTBEAT_MS);

    const input = GenerationInputSchema.parse(job.inputJson);
    const reportId = createEntityId("rpt");
    const generatePolicy = dependencies.generatePolicy ?? generatePolicyFromProjectFacts;
    const result: PolicyGeneratorResult = await generatePolicy(reportId, input.formData, {
      onStage: async (stage, message) => {
        await updateProgress(prisma, job.id, workerId, stageToDatabase(stage), { message });
      },
      onProgress: (progress) => {
        const now = Date.now();
        if (now - lastProgressWrite < 1_000 && progress.phase !== "VALIDATED") return;
        lastProgressWrite = now;
        void updateProgress(prisma, job.id, workerId, "DRAFTING", progress, progress.previewMarkdown);
      },
    });
    const docxHash = `sha256:${createHash("sha256").update(result.docx).digest("hex")}`;
    const storage = new MysqlReportStorage(prisma);
    const stored = await storage.prepare(reportId, result.docx, docxHash);

    await prisma.$transaction(async (tx) => {
      const currentProject = await tx.project.findUnique({ where: { id: job.projectId }, select: { revision: true } });
      if (!currentProject) throw new DomainError("PROJECT_NOT_FOUND", "项目已不存在。", { retryable: false });
      const superseded = currentProject.revision !== job.projectRevision;
      const completed = await tx.generationJob.updateMany({
        where: { id: job.id, state: "RUNNING", leaseOwner: workerId },
        data: {
          state: superseded ? "SUPERSEDED" : "SUCCEEDED",
          stage: "COMPLETED",
          previewMarkdown: result.markdown,
          progressJson: { completedSections: 8, totalSections: 8, characterCount: result.markdown.length },
          completedAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      if (completed.count !== 1) {
        throw new DomainError("GENERATION_IN_PROGRESS", "生成任务租约已由其他 Worker 接管。", { retryable: true });
      }
      if (!superseded) {
        await tx.report.updateMany({ where: { projectId: job.projectId, state: "CURRENT" }, data: { state: "SUPERSEDED" } });
      }
      await tx.report.create({
        data: {
          id: reportId,
          projectId: job.projectId,
          generationId: job.id,
          projectRevision: job.projectRevision,
          inputHash: job.inputHash,
          state: superseded ? "SUPERSEDED" : "CURRENT",
          filename: result.filename,
          markdown: result.markdown,
          storageKind: stored.storageKind,
          storageKey: stored.storageKey,
          docx: stored.docx ? new Uint8Array(stored.docx) : null,
          docxHash: stored.docxHash,
        },
      });
      await tx.auditEvent.create({ data: {
        id: createEntityId("aud"), projectId: job.projectId, userId: job.requestedById,
        action: superseded ? "GENERATION_SUPERSEDED" : "GENERATION_SUCCEEDED",
        metadata: { generationId: job.id, reportId, projectRevision: job.projectRevision },
      } });
    });
  } catch (error) {
    const domainError = isDomainError(error)
      ? error
      : new DomainError("DOCX_GENERATION_FAILED", "隐私政策生成失败。", { retryable: true });
    const retry = domainError.retryable && job.attemptCount < MAX_ATTEMPTS;
    await prisma.$transaction(async (tx) => {
      const updated = await tx.generationJob.updateMany({ where: { id: job.id, leaseOwner: workerId }, data: {
        state: retry ? "QUEUED" : "FAILED",
        errorCode: domainError.code,
        errorMessage: domainError.message,
        errorDetails: domainError.details
          ? domainError.details as Prisma.InputJsonValue
          : Prisma.DbNull,
        completedAt: retry ? null : new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
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
  }
  return true;
}

async function claimNextJob(prisma: PrismaClient, workerId: string): Promise<GenerationJob | null> {
  const expiredAt = new Date();
  await prisma.generationJob.updateMany({
    where: { state: "RUNNING", leaseExpiresAt: { lte: expiredAt }, attemptCount: { gte: MAX_ATTEMPTS } },
    data: {
      state: "FAILED",
      errorCode: "GENERATION_IN_PROGRESS",
      errorMessage: "生成任务多次失去 Worker 心跳，已停止自动重试。",
      completedAt: expiredAt,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const claimTime = new Date();
    const candidate = await prisma.generationJob.findFirst({
      where: {
        attemptCount: { lt: MAX_ATTEMPTS },
        OR: [
          { state: "QUEUED" },
          { state: "RUNNING", leaseExpiresAt: { lte: claimTime } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!candidate) return null;
    const claimed = await prisma.generationJob.updateMany({
      where: {
        id: candidate.id,
        attemptCount: { lt: MAX_ATTEMPTS },
        OR: [{ state: "QUEUED" }, { state: "RUNNING", leaseExpiresAt: { lte: claimTime } }],
      },
      data: {
        state: "RUNNING",
        leaseOwner: workerId,
        leaseExpiresAt: new Date(Date.now() + LEASE_MS),
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

async function renewLease(prisma: PrismaClient, jobId: string, workerId: string): Promise<void> {
  const renewed = await prisma.generationJob.updateMany({
    where: { id: jobId, state: "RUNNING", leaseOwner: workerId },
    data: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
  });
  if (renewed.count !== 1) {
    throw new DomainError("GENERATION_IN_PROGRESS", "生成任务租约已由其他 Worker 接管。", { retryable: true });
  }
}

async function updateProgress(
  prisma: PrismaClient,
  jobId: string,
  workerId: string,
  stage: GenerationStage,
  progress: unknown,
  previewMarkdown?: string,
): Promise<void> {
  await prisma.generationJob.updateMany({
    where: { id: jobId, state: "RUNNING", leaseOwner: workerId },
    data: {
      stage,
      progressJson: progress as Prisma.InputJsonValue,
      ...(previewMarkdown === undefined ? {} : { previewMarkdown }),
    },
  });
}

function stageToDatabase(stage: PolicyGeneratorStage): GenerationStage {
  return stage;
}

function hashJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function toJobView(job: GenerationJob & { report?: { id: string } | null }): GenerationJobView {
  return {
    id: job.id,
    projectId: job.projectId,
    projectRevision: job.projectRevision,
    state: job.state,
    stage: job.stage,
    progress: job.progressJson,
    previewMarkdown: job.previewMarkdown,
    error: job.errorCode
      ? { code: job.errorCode, message: job.errorMessage ?? "生成失败。", details: job.errorDetails }
      : null,
    reportId: job.report?.id ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}
