import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { verifiedMapV1Content } from "@/src/content/map-v1/server-content";
import { requireDevActor } from "@/src/auth/session";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { ensureDevUsers } from "@/src/data/dev-seed";
import { getPrisma } from "@/src/data/prisma";
import { isDomainError } from "@/src/domain/errors";

const CreateProjectSchema = z.object({
  // 创建时允许“只填了范围门禁”的部分数据；完整校验在后续 PUT 时以
  // ProjectFormDataSchema 强制进行（见 [id]/route.ts）。
  formData: z.unknown().optional(),
});

export async function POST(request: Request) {
  if (!isDevPersonaEnabled()) {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }
  try {
    const actor = requireDevActor(request);
    const parsed = CreateProjectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_PROJECT_INPUT", details: parsed.error.flatten() }, { status: 400 });
    }
    await ensureDevUsers();

    const prisma = getPrisma();
    const id = `map-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
    const productName = (parsed.data.formData as { profile?: { productName?: string } } | undefined)?.profile?.productName ?? null;
    const project = await prisma.project.create({
      data: {
        id,
        tenantId: actor.tenantId,
        ownerId: actor.userId,
        name: productName ?? "地图导航类试点",
        productName,
        contentVersion: verifiedMapV1Content.contentVersion,
        contentHash: verifiedMapV1Content.contentHash,
        formData: parsed.data.formData ?? {},
        revision: 0,
      },
      select: { id: true, revision: true },
    });
    return NextResponse.json({ projectId: project.id, revision: project.revision });
  } catch (error) {
    if (isDomainError(error)) {
      const status = error.code === "PROJECT_FORBIDDEN" ? 403 : 503;
      return NextResponse.json({ code: error.code, message: error.message }, { status });
    }
    return NextResponse.json({ code: "PROJECT_CREATE_FAILED", message: "项目创建失败。" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isDevPersonaEnabled()) {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }
  try {
    const actor = requireDevActor(request);
    await ensureDevUsers();

    const prisma = getPrisma();
    const projects = await prisma.project.findMany({
      where: { tenantId: actor.tenantId, OR: [{ ownerId: actor.userId }, { access: { some: { userId: actor.userId } } }] },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, productName: true, revision: true, updatedAt: true, formData: true },
    });
    const items = projects.map((project) => {
      const form = (project.formData ?? {}) as { scopeStop?: string };
      return {
        id: project.id,
        name: project.productName ?? project.name,
        productName: project.productName,
        revision: project.revision,
        scopeStop: form.scopeStop ?? undefined,
        updatedAt: project.updatedAt.toISOString(),
      };
    });
    return NextResponse.json({ projects: items });
  } catch (error) {
    if (isDomainError(error)) {
      const status = error.code === "PROJECT_FORBIDDEN" ? 403 : 503;
      return NextResponse.json({ code: error.code, message: error.message }, { status });
    }
    return NextResponse.json({ code: "PROJECT_LIST_FAILED", message: "项目列表加载失败。" }, { status: 500 });
  }
}
