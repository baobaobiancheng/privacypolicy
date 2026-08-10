import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "@/src/data/prisma";
import type { Actor } from "@/src/application/authorization";
import type { UpdateFactStore, UpdateFactTransaction, UpdateFactCommand, UpdateFactResult } from "@/src/application/commands/update-fact";

const AuditResultSchema = z.object({
  projectId: z.string(),
  assertionId: z.string(),
  projectRevision: z.number().int(),
  valueVersion: z.number().int(),
});

/** 把事务命令合同绑定到 Prisma；领域层不直接依赖 Prisma。 */
export function createPrismaUpdateFactStore(prisma: PrismaClient = getPrisma()): UpdateFactStore {
  return {
    transaction<T>(callback: (transaction: UpdateFactTransaction) => Promise<T>) {
      return prisma.$transaction((tx) => callback(createTransaction(tx)));
    },
  };
}

function createTransaction(tx: Prisma.TransactionClient): UpdateFactTransaction {
  return {
    async findProjectAccess(projectId) {
      const project = await tx.project.findUnique({ where: { id: projectId }, include: { access: true } });
      if (!project) return null;
      return { tenantId: project.tenantId, ownerId: project.ownerId, access: project.access.map((item) => ({ userId: item.userId, role: item.role })) };
    },

    async findCommand(commandId): Promise<UpdateFactResult | null> {
      const event = await tx.auditEvent.findUnique({ where: { commandId } });
      if (!event) return null;
      const parsed = AuditResultSchema.safeParse(event.metadata);
      return parsed.success ? parsed.data : null;
    },

    async compareAndAdvanceProject(projectId, expectedRevision) {
      const result = await tx.project.updateMany({
        where: { id: projectId, revision: expectedRevision },
        data: { revision: { increment: 1 }, status: "INFORMATION_COLLECTING" },
      });
      return result.count === 1;
    },

    async replaceCurrentAssertion(command, nextValueVersion) {
      // 按事实 tuple 退休当前行（id 与新 assertionId 无关）。
      await tx.factAssertion.updateMany({
        where: {
          projectId: command.projectId,
          subjectKey: command.subjectKey,
          groupKey: command.groupKey,
          fieldKey: command.fieldKey,
          current: true,
        },
        data: { current: false },
      });
      // 以 command.assertionId 新建当前行；schema 已将复合键从 unique 降为 index，允许多版本并存。
      await tx.factAssertion.create({
        data: {
          id: command.assertionId,
          projectId: command.projectId,
          subjectKey: command.subjectKey,
          groupKey: command.groupKey,
          fieldKey: command.fieldKey,
          value: command.value as Prisma.InputJsonValue,
          valueVersion: nextValueVersion,
          originType: command.originType,
          factVerification: "UNCONFIRMED",
          legalReview: "PENDING",
          current: true,
        },
      });
    },

    async invalidateCurrentConfirmations(command) {
      // 确认挂在旧断言行上；按事实 tuple 查出所有版本行的 id 再失效，而不是按新 assertionId。
      const rows = await tx.factAssertion.findMany({
        where: {
          projectId: command.projectId,
          subjectKey: command.subjectKey,
          groupKey: command.groupKey,
          fieldKey: command.fieldKey,
        },
        select: { id: true },
      });
      if (rows.length === 0) return;
      await tx.confirmation.updateMany({
        where: { assertionId: { in: rows.map((row) => row.id) }, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
    },

    async invalidateCurrentDrafts(projectId) {
      // 快照本身不可变；只将项目的当前导出位置退回信息收集中。
      await tx.project.update({ where: { id: projectId }, data: { status: "INFORMATION_COLLECTING" } });
    },

    async writeAudit(command: UpdateFactCommand, actor: Actor) {
      const metadata = {
        projectId: command.projectId,
        assertionId: command.assertionId,
        projectRevision: command.expectedProjectRevision + 1,
        valueVersion: command.expectedProjectRevision + 1,
      } satisfies Prisma.InputJsonObject;
      await tx.auditEvent.create({
        data: {
          id: `audit-${command.commandId}`,
          commandId: command.commandId,
          projectId: command.projectId,
          userId: actor.userId,
          action: "UPDATE_FACT",
          metadata,
        },
      });
    },
  };
}
