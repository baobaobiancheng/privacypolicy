import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireDevActor } from "@/src/auth/session";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { ensureDevUsers } from "@/src/data/dev-seed";
import { getPrisma } from "@/src/data/prisma";
import { authorizeProject, type ProjectAccessRecord } from "@/src/application/authorization";
import { isDomainError } from "@/src/domain/errors";

const SaveProjectSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  formData: z.unknown(),
});

type RouteContext = { params: Promise<{ id: string }> };

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
  const actor = requireDevActor(request);
  await ensureDevUsers();

  const { prisma, project, access } = await loadAccess(id);
  authorizeProject(actor, access, "READ");
  return NextResponse.json({ projectId: id, revision: project!.revision, formData: project!.formData ?? null });
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!isDevPersonaEnabled()) {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }
  const { id } = await params;
  const actor = requireDevActor(request);
  await ensureDevUsers();

  const parsed = SaveProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_PROJECT_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { prisma, access } = await loadAccess(id);
  authorizeProject(actor, access, "EDIT");

  try {
    const updated = await prisma.project.updateMany({
      where: { id, revision: parsed.data.expectedRevision },
      data: { formData: parsed.data.formData as Prisma.InputJsonValue, revision: { increment: 1 } },
    });
    if (updated.count === 0) {
      const current = await prisma.project.findUnique({ where: { id }, select: { revision: true } });
      return NextResponse.json({ code: "PROJECT_REVISION_CONFLICT", revision: current?.revision ?? 0 }, { status: 409 });
    }
    return NextResponse.json({ projectId: id, revision: parsed.data.expectedRevision + 1 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: 503 });
    }
    return NextResponse.json({ code: "PROJECT_SAVE_FAILED", message: "项目保存失败。" }, { status: 500 });
  }
}
