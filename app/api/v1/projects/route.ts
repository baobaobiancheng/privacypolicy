import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireDevActor } from "@/src/auth/session";
import { ensureDevUsers } from "@/src/data/dev-seed";
import { getPrisma } from "@/src/data/prisma";
import { apiError, getRequestId, invalidInput } from "@/src/http/api-error";
import { createEntityId } from "@/src/domain/ids";
import { DomainError } from "@/src/domain/errors";
import { appCategoryRegistry, getAppCategory } from "@/src/categories";
import { getAppQuestionnaire } from "@/src/questionnaires";
import { calculateProjectProgress, FORM_SCHEMA_VERSION, ProjectFormDataSchema } from "@/src/workspace/contract";
import {
  createDevelopmentProjectFormData,
  developmentFormDefaultsEnabled,
} from "@/src/workspace/development-defaults";
import { projectListSelect } from "@/src/data/project-list-query";
import { withApiTiming } from "@/src/http/request-timing";
import { USAGE_CONFIRMATION_VERSION } from "@/src/workspace/usage-confirmation";

export const runtime = "nodejs";

const CreateProjectSchema = z.object({
  categoryKey: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(128),
  usageConfirmation: z.object({
    accepted: z.literal(true),
    version: z.literal(USAGE_CONFIRMATION_VERSION),
  }).strict(),
  formData: ProjectFormDataSchema.optional(),
}).strict();

const CursorSchema = z.object({ updatedAt: z.string().datetime(), id: z.string().min(1) }).strict();

export async function POST(request: Request) {
  return withApiTiming(request, "/api/v1/projects", async () => {
  try {
    const actor = requireDevActor(request);
    const parsed = CreateProjectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw invalidInput("项目参数不完整。", { issues: parsed.error.flatten() });
    const category = getAppCategory(parsed.data.categoryKey);
    if (!category || category.availability !== "OPEN") {
      throw new DomainError("CATEGORY_NOT_AVAILABLE", "该应用类别的行业问卷正在建设中。", { retryable: false });
    }
    await ensureDevUsers();
    const prisma = getPrisma();
    const requestId = getRequestId(request);
    const formData = parsed.data.formData
      ?? (developmentFormDefaultsEnabled()
        ? createDevelopmentProjectFormData(category.key)
        : ProjectFormDataSchema.parse({ schemaVersion: FORM_SCHEMA_VERSION }));
    const questionnaire = getAppQuestionnaire(category.key);
    const productName = formData.profile.productName?.trim() || null;
    const uniqueKey = {
      tenantId: actor.tenantId,
      ownerId: actor.userId,
      creationKey: parsed.data.idempotencyKey,
    };
    const existing = await prisma.project.findUnique({
      where: { tenantId_ownerId_creationKey: uniqueKey },
      select: projectCreationSelect,
    });
    if (existing) return projectCreationResponse(existing, requestId, true);

    try {
      const project = await prisma.$transaction(async (tx) => {
        const created = await tx.project.create({ data: {
          id: createEntityId("prj"),
          tenantId: actor.tenantId,
          ownerId: actor.userId,
          creationKey: parsed.data.idempotencyKey,
          name: productName ?? `未命名${category.label}项目`,
          productName,
          formSchemaVersion: FORM_SCHEMA_VERSION,
          categoryKey: category.key,
          categoryVersion: appCategoryRegistry.categoryVersion,
          currentStepKey: "profile",
          progressPercent: calculateProjectProgress(formData),
          contentVersion: questionnaire.contentVersion,
          contentHash: questionnaire.contentHash,
          formData: formData as unknown as Prisma.InputJsonValue,
        }, select: projectCreationSelect });
        await tx.auditEvent.create({ data: {
          id: createEntityId("aud"), requestId, projectId: created.id, userId: actor.userId,
          action: "PROJECT_CREATED", metadata: {
            categoryKey: category.key,
            schemaVersion: formData.schemaVersion,
            usageConfirmationVersion: parsed.data.usageConfirmation.version,
            usageConfirmedAt: new Date().toISOString(),
          },
        } });
        return created;
      });
      return projectCreationResponse(project, requestId, false);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const concurrent = await prisma.project.findUnique({
        where: { tenantId_ownerId_creationKey: uniqueKey },
        select: projectCreationSelect,
      });
      if (!concurrent) throw error;
      return projectCreationResponse(concurrent, requestId, true);
    }
  } catch (error) {
    return apiError(error, request, "项目创建失败。");
  }
  });
}

const projectCreationSelect = {
  id: true,
  revision: true,
  categoryKey: true,
  currentStepKey: true,
} satisfies Prisma.ProjectSelect;

function projectCreationResponse(
  project: { id: string; revision: number; categoryKey: string; currentStepKey: string },
  requestId: string,
  reused: boolean,
) {
  return NextResponse.json({ data: { ...project, reused }, requestId }, {
    status: reused ? 200 : 201,
    headers: { Location: `/projects/${project.id}`, "x-request-id": requestId },
  });
}

export async function GET(request: Request) {
  return withApiTiming(request, "/api/v1/projects", async () => {
  try {
    const actor = requireDevActor(request);
    await ensureDevUsers();
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const prisma = getPrisma();
    const projects = await prisma.project.findMany({
      where: {
        tenantId: actor.tenantId,
        OR: [{ ownerId: actor.userId }, { access: { some: { userId: actor.userId } } }],
        ...(cursor ? {
          AND: [{ OR: [
            { updatedAt: { lt: new Date(cursor.updatedAt) } },
            { updatedAt: new Date(cursor.updatedAt), id: { lt: cursor.id } },
          ] }],
        } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: projectListSelect,
    });
    const hasMore = projects.length > limit;
    const page = projects.slice(0, limit);
    const items = page.map((project) => {
      const category = getAppCategory(project.categoryKey);
      const latest = project.reports[0];
      return {
        id: project.id,
        name: project.productName ?? project.name,
        productName: project.productName,
        revision: project.revision,
        categoryKey: project.categoryKey,
        categoryLabel: category?.label ?? project.categoryKey,
        categoryVersion: project.categoryVersion,
        currentStepKey: project.currentStepKey,
        status: project.status,
        progress: project.progressPercent,
        latestReport: latest ? reportSummary(project.id, latest) : null,
        updatedAt: project.updatedAt.toISOString(),
      };
    });
    const last = page.at(-1);
    const requestId = getRequestId(request);
    return NextResponse.json({
      data: { items, nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : null },
      requestId,
    }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error, request, "项目列表加载失败。");
  }
  });
}

function reportSummary(projectId: string, report: { id: string; createdAt: Date }) {
  return {
    id: report.id,
    createdAt: report.createdAt.toISOString(),
    previewUrl: `/api/v1/projects/${projectId}/reports/${report.id}`,
    downloadUrl: `/api/v1/projects/${projectId}/reports/${report.id}/content`,
  };
}

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id })).toString("base64url");
}

function decodeCursor(value: string | null): z.infer<typeof CursorSchema> | null {
  if (!value) return null;
  try {
    return CursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw invalidInput("分页游标无效。");
  }
}
