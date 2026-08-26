import type { GenerationJob, PrismaClient } from "@prisma/client";
import { DomainError } from "@/src/domain/errors";
import { createEntityId } from "@/src/domain/ids";
import type { StoredReportDocument } from "@/src/storage/report-storage";
import type { PolicyGeneratorResult } from "./policy-generator";

export async function commitGenerationReport(input: {
  prisma: PrismaClient;
  job: GenerationJob;
  workerId: string;
  reportId: string;
  result: PolicyGeneratorResult;
  stored: StoredReportDocument;
}): Promise<void> {
  const { prisma, job, workerId, reportId, result, stored } = input;
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
        activeInputKey: null,
      },
    });
    if (completed.count !== 1) {
      throw new DomainError("GENERATION_IN_PROGRESS", "生成任务租约已由其他 Worker 接管。", { retryable: true });
    }
    if (!superseded) {
      await tx.report.updateMany({ where: { projectId: job.projectId, state: "CURRENT" }, data: { state: "SUPERSEDED" } });
      await tx.project.update({
        where: { id: job.projectId },
        data: { progressPercent: 100, currentStepKey: "generate" },
      });
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
}
