import { NextResponse } from "next/server";
import { requireDevActor } from "@/src/auth/session";
import { ensureDevUsers } from "@/src/data/dev-seed";
import { getPrisma } from "@/src/data/prisma";
import { authorizeProject, type ProjectAccessRecord } from "@/src/application/authorization";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }
  const { id } = await params;
  const actor = requireDevActor(request);
  await ensureDevUsers();

  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { id }, include: { access: true } });
  const access: ProjectAccessRecord | null = project
    ? { tenantId: project.tenantId, ownerId: project.ownerId, access: project.access.map((item) => ({ userId: item.userId, role: item.role })) }
    : null;
  authorizeProject(actor, access, "READ");

  const snapshots = await prisma.draftSnapshot.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const items = snapshots.map((snapshot) => ({
    id: snapshot.id,
    state: snapshot.state,
    createdAt: snapshot.createdAt.toISOString(),
    failureCode: snapshot.failureCode,
    markdown: snapshot.markdown,
    docxBase64: snapshot.docx ? Buffer.from(snapshot.docx).toString("base64") : null,
  }));
  return NextResponse.json({ snapshots: items });
}
