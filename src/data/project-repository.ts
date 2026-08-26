import type { PrismaClient } from "@prisma/client";
import { authorizeProject, type Actor, type ProjectAction } from "@/src/application/authorization";
import { DomainError } from "@/src/domain/errors";
import { getPrisma } from "./prisma";

export async function loadProject(
  actor: Actor,
  projectId: string,
  action: ProjectAction,
  prisma: PrismaClient = getPrisma(),
) {
  const project = await prisma.project.findFirst({
    where: accessibleProjectWhere(actor, projectId),
    include: { access: { where: { userId: actor.userId }, select: { userId: true, role: true } } },
  });

  if (!project) {
    throw new DomainError("PROJECT_NOT_FOUND", "项目不存在或你无权访问。", { retryable: false });
  }
  authorizeProject(actor, project, action);
  return project;
}

export async function loadProjectWithLatestReport(
  actor: Actor,
  projectId: string,
  action: ProjectAction,
  prisma: PrismaClient = getPrisma(),
) {
  const project = await prisma.project.findFirst({
    where: accessibleProjectWhere(actor, projectId),
    include: {
      access: { where: { userId: actor.userId }, select: { userId: true, role: true } },
      reports: {
        where: { state: "CURRENT" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, filename: true, createdAt: true },
      },
    },
  });
  if (!project) {
    throw new DomainError("PROJECT_NOT_FOUND", "项目不存在或你无权访问。", { retryable: false });
  }
  authorizeProject(actor, project, action);
  return project;
}

function accessibleProjectWhere(actor: Actor, projectId: string) {
  return {
    id: projectId,
    tenantId: actor.tenantId,
    OR: [{ ownerId: actor.userId }, { access: { some: { userId: actor.userId } } }],
  };
}

/** Temporary alias while the workspace UI is migrated to the v1 API. */
export const loadProjectSnapshot = loadProject;
