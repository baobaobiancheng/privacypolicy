import type { GenerationJob } from "@prisma/client";

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

export function toGenerationJobView(
  job: GenerationJob & { report?: { id: string } | null },
): GenerationJobView {
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
