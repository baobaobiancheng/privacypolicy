import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { SessionActor } from "@/src/auth/session";
import { loadProject } from "@/src/data/project-repository";
import { DomainError } from "@/src/domain/errors";
import { createEntityId } from "@/src/domain/ids";
import { ProjectFormDataSchema } from "@/src/workspace/contract";
import { GenerationInputSchema } from "@/src/workspace/form-adapter";
import { toGenerationJobView, type GenerationJobView } from "./job-view";
import { resolvePreflightExecutionPlan } from "./preflight-acknowledgements";

export type EnqueueGenerationOptions = {
  acknowledgedPreflightIssues?: readonly string[];
};

export async function enqueueGeneration(
  prisma: PrismaClient,
  actor: SessionActor,
  projectId: string,
  idempotencyKey: string,
  requestId?: string,
  options: EnqueueGenerationOptions = {},
): Promise<{ job: GenerationJobView; reused: boolean }> {
  if (!idempotencyKey.trim() || idempotencyKey.length > 128) {
    throw new DomainError("FIELD_INVALID", "缺少有效的幂等键。", { retryable: false });
  }
  const project = await loadProject(actor, projectId, "EDIT", prisma);
  const formData = ProjectFormDataSchema.parse(project.formData);
  const baseInput = {
    schemaVersion: formData.schemaVersion,
    categoryKey: project.categoryKey,
    projectRevision: project.revision,
    formData,
  };
  const inputHash = hashJson(baseInput);
  const preflightPlan = await resolvePreflightExecutionPlan(
    prisma,
    projectId,
    inputHash,
    options.acknowledgedPreflightIssues ?? [],
  );
  const input = GenerationInputSchema.parse({
    ...baseInput,
    acknowledgedPreflightIssues: preflightPlan.acknowledgedFingerprints,
    preflightRound: preflightPlan.round,
    cachedPreflight: preflightPlan.cachedPreflight,
  });
  const activeInputKey = hashJson({ projectId, inputHash });
  const existing = await prisma.generationJob.findUnique({
    where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
    include: { report: { select: { id: true } } },
  });
  if (existing) {
    if (existing.inputHash !== inputHash) {
      throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已更新，请使用新的生成请求。", { retryable: true });
    }
    return { job: toGenerationJobView(existing), reused: true };
  }
  const active = await prisma.generationJob.findUnique({
    where: { activeInputKey },
    include: { report: { select: { id: true } } },
  });
  if (active) return { job: toGenerationJobView(active), reused: true };

  try {
    const created = await prisma.$transaction(async (tx) => {
      const job = await tx.generationJob.create({ data: {
        id: createEntityId("gen"),
        projectId,
        requestedById: actor.userId,
        projectRevision: project.revision,
        idempotencyKey,
        inputHash,
        activeInputKey,
        inputJson: input as unknown as Prisma.InputJsonValue,
        progressJson: { completedSections: 0, totalSections: 8, characterCount: 0 },
      }, include: { report: { select: { id: true } } } });
      await tx.auditEvent.create({ data: {
        id: createEntityId("aud"), requestId, projectId, userId: actor.userId,
        action: "GENERATION_QUEUED", metadata: { generationId: job.id, projectRevision: project.revision, inputHash },
      } });
      return job;
    });
    return { job: toGenerationJobView(created), reused: false };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const concurrentByRequest = await prisma.generationJob.findUnique({
      where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
      include: { report: { select: { id: true } } },
    });
    if (concurrentByRequest) {
      if (concurrentByRequest.inputHash !== inputHash) {
        throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已更新，请使用新的生成请求。", { retryable: true });
      }
      return { job: toGenerationJobView(concurrentByRequest), reused: true };
    }
    const concurrentByInput = await prisma.generationJob.findUnique({
      where: { activeInputKey },
      include: { report: { select: { id: true } } },
    });
    if (!concurrentByInput) {
      throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已更新，请使用新的生成请求。", { retryable: true });
    }
    return { job: toGenerationJobView(concurrentByInput), reused: true };
  }
}

export async function getLatestGenerationForRevision(
  prisma: PrismaClient,
  projectId: string,
  projectRevision: number,
): Promise<GenerationJobView | null> {
  const job = await prisma.generationJob.findFirst({
    where: { projectId, projectRevision },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { report: { select: { id: true } } },
  });
  return job ? toGenerationJobView(job) : null;
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
  return toGenerationJobView(job);
}

function hashJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
