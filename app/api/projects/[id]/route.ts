import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireDevActor } from "@/src/auth/session";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { ensureDevUsers } from "@/src/data/dev-seed";
import { getPrisma } from "@/src/data/prisma";
import { authorizeProject, type ProjectAccessRecord } from "@/src/application/authorization";
import { isDomainError, DomainError } from "@/src/domain/errors";
import { ProjectFormDataSchema } from "@/src/workspace/contract";

const SaveProjectSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  formData: ProjectFormDataSchema,
});

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (isDomainError(error)) {
    const status = error.code === "PROJECT_FORBIDDEN" ? 403 : error.code === "PROJECT_REVISION_CONFLICT" ? 409 : 500;
    return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status });
  }
  return NextResponse.json({ code: "PROJECT_SAVE_FAILED", message: "项目保存失败。" }, { status: 500 });
}

async function loadAccess(id: string) {
  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { id }, include: { access: true } });
  const access: ProjectAccessRecord | null = project
    ? { tenantId: project.tenantId, ownerId: project.ownerId, access: project.access.map((item) => ({ userId: item.userId, role: item.role })) }
    : null;
  return { prisma, project, access };
}

export async function GET(request: Request, { params }: RouteContext) {
  if (!isDevPersonaEnabled()) {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }
  const { id } = await params;
  try {
    const actor = requireDevActor(request);
    await ensureDevUsers();

    const { prisma, project, access } = await loadAccess(id);
    authorizeProject(actor, access, "READ");
    return NextResponse.json({ projectId: id, revision: project!.revision, formData: project!.formData ?? null });
  } catch (error) {
    if (isDomainError(error)) {
      const status = error.code === "PROJECT_FORBIDDEN" ? 404 : 500;
      return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status });
    }
    return NextResponse.json({ code: "PROJECT_LOAD_FAILED", message: "项目加载失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!isDevPersonaEnabled()) {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }
  const { id } = await params;
  try {
    const actor = requireDevActor(request);

    const parsed = SaveProjectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_PROJECT_INPUT", details: parsed.error.flatten() }, { status: 400 });
    }
    await ensureDevUsers();
    const { prisma, project, access } = await loadAccess(id);
    authorizeProject(actor, access, "EDIT");

    const updated = await prisma.project.updateMany({
      where: { id, revision: parsed.data.expectedRevision },
      data: {
        formData: parsed.data.formData as Prisma.InputJsonValue,
        revision: { increment: 1 },
        ...(parsed.data.formData.profile?.productName
          ? { productName: parsed.data.formData.profile.productName, name: parsed.data.formData.profile.productName }
          : {}),
      },
    });
    if (updated.count === 0) {
      const current = await prisma.project.findUnique({ where: { id }, select: { revision: true } });
      throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已在其他页面更新，请重试。", { retryable: true, details: { revision: String(current?.revision ?? 0) } });
    }
    return NextResponse.json({ projectId: id, revision: parsed.data.expectedRevision + 1 });
  } catch (error) {
    if (isDomainError(error) && error.code === "PROJECT_REVISION_CONFLICT") {
      return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable, revision: Number(error.details?.revision ?? 0) }, { status: 409 });
    }
    return errorResponse(error);
  }
}
