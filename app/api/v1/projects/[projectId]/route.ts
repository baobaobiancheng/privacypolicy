import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireDevActor } from "@/src/auth/session";
import { getPrisma } from "@/src/data/prisma";
import { loadProject } from "@/src/data/project-repository";
import { apiError, getRequestId, invalidInput } from "@/src/http/api-error";
import { DomainError } from "@/src/domain/errors";
import { createEntityId } from "@/src/domain/ids";
import { getAppCategory } from "@/src/categories";
import { ProjectFormDataSchema } from "@/src/workspace/contract";
import { requireEntityId } from "@/src/http/route-params";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ projectId: string }> };

const SaveProjectSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  formData: ProjectFormDataSchema,
  currentStepKey: z.enum(["profile", "processing", "permissions", "partners", "storage", "generate"]).optional(),
}).strict();

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const actor = requireDevActor(request);
    const projectId = requireEntityId((await params).projectId, "prj", "项目 ID");
    const prisma = getPrisma();
    const [project, latestReport] = await Promise.all([
      loadProject(actor, projectId, "READ", prisma),
      prisma.report.findFirst({
        where: { projectId, state: "CURRENT" },
        orderBy: { createdAt: "desc" },
        select: { id: true, filename: true, createdAt: true },
      }),
    ]);
    const category = getAppCategory(project.categoryKey);
    const requestId = getRequestId(request);
    return NextResponse.json({
      data: {
        id: project.id,
        revision: project.revision,
        name: project.name,
        productName: project.productName,
        categoryKey: project.categoryKey,
        categoryLabel: category?.label ?? project.categoryKey,
        categoryVersion: project.categoryVersion,
        currentStepKey: project.currentStepKey,
        status: project.status,
        formSchemaVersion: project.formSchemaVersion,
        formData: project.formData,
        latestReport: latestReport ? {
          id: latestReport.id,
          filename: latestReport.filename,
          createdAt: latestReport.createdAt.toISOString(),
          previewUrl: `/api/v1/projects/${projectId}/reports/${latestReport.id}`,
          downloadUrl: `/api/v1/projects/${projectId}/reports/${latestReport.id}/content`,
        } : null,
      },
      requestId,
    }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error, request, "项目加载失败。");
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const actor = requireDevActor(request);
    const projectId = requireEntityId((await params).projectId, "prj", "项目 ID");
    const parsed = SaveProjectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw invalidInput("项目表单格式无效。", { issues: parsed.error.flatten() });
    const prisma = getPrisma();
    const requestId = getRequestId(request);
    await loadProject(actor, projectId, "EDIT", prisma);
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.project.updateMany({ where: { id: projectId, revision: parsed.data.expectedRevision }, data: {
        formData: parsed.data.formData as unknown as Prisma.InputJsonValue,
        formSchemaVersion: parsed.data.formData.schemaVersion,
        ...(parsed.data.currentStepKey ? { currentStepKey: parsed.data.currentStepKey } : {}),
        revision: { increment: 1 },
        ...(parsed.data.formData.profile.productName
          ? { productName: parsed.data.formData.profile.productName, name: parsed.data.formData.profile.productName }
          : {}),
      } });
      if (result.count === 1) {
        await tx.auditEvent.create({ data: {
          id: createEntityId("aud"), requestId, projectId, userId: actor.userId,
          action: "PROJECT_FORM_SAVED",
          metadata: { fromRevision: parsed.data.expectedRevision, toRevision: parsed.data.expectedRevision + 1, currentStepKey: parsed.data.currentStepKey ?? null },
        } });
      }
      return result;
    });
    if (updated.count !== 1) {
      const current = await prisma.project.findUnique({ where: { id: projectId }, select: { revision: true } });
      throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已更新，请重新载入。", {
        retryable: true,
        details: { currentRevision: current?.revision ?? null },
      });
    }
    return NextResponse.json({ data: { id: projectId, revision: parsed.data.expectedRevision + 1 }, requestId }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error, request, "项目保存失败。");
  }
}
