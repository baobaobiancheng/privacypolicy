import type { PrismaClient } from "@prisma/client";
import { authorizeProject, type Actor, type ProjectAction } from "@/src/application/authorization";
import { DomainError } from "@/src/domain/errors";
import { getPrisma } from "./prisma";

export async function loadProjectSnapshot(actor: Actor, projectId: string, action: ProjectAction, prisma: PrismaClient = getPrisma()) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      tenantId: actor.tenantId,
      OR: [
        { ownerId: actor.userId },
        { access: { some: { userId: actor.userId } } },
      ],
    },
    include: {
      access: true,
      activities: {
        include: {
          assertions: { where: { current: true }, include: { confirmations: true, provenance: { include: { evidence: true } } } },
          recipients: { include: { assertions: { where: { current: true } } } },
          tasks: true,
        },
      },
      assertions: { where: { current: true }, include: { confirmations: true, provenance: { include: { evidence: true } } } },
      recipients: { include: { assertions: { where: { current: true } } } },
      tasks: true,
      snapshots: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!project) throw new DomainError("PROJECT_FORBIDDEN", "你无权访问该项目。", { retryable: true });
  authorizeProject(actor, project, action);
  return project;
}
