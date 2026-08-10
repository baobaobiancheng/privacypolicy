import { z } from "zod";
import { DomainError } from "@/src/domain/errors";
import { type Actor, authorizeProject } from "@/src/application/authorization";

const FactValueSchema = z.union([z.string().trim().min(1), z.number(), z.boolean(), z.null()]);

export const UpdateFactCommandSchema = z.object({
  commandId: z.string().min(8).max(120),
  projectId: z.string().min(1),
  expectedProjectRevision: z.number().int().nonnegative(),
  assertionId: z.string().min(1),
  subjectKey: z.string().min(1),
  groupKey: z.string().min(1),
  fieldKey: z.string().min(1),
  value: FactValueSchema,
  originType: z.enum(["CLIENT_ORIGINAL", "REGULATION", "EXPERT_CONTENT", "REFERENCE_POLICY", "AI_INFERRED"]),
});

export type UpdateFactCommand = z.infer<typeof UpdateFactCommandSchema>;

export type UpdateFactTransaction = {
  findProjectAccess(projectId: string): Promise<{ tenantId: string; ownerId: string; access: Array<{ userId: string; role: Actor["role"] }> } | null>;
  findCommand(commandId: string): Promise<UpdateFactResult | null>;
  compareAndAdvanceProject(projectId: string, expectedRevision: number): Promise<boolean>;
  replaceCurrentAssertion(command: UpdateFactCommand, nextValueVersion: number): Promise<void>;
  invalidateCurrentConfirmations(factKey: Pick<UpdateFactCommand, "projectId" | "subjectKey" | "groupKey" | "fieldKey">): Promise<void>;
  invalidateCurrentDrafts(projectId: string): Promise<void>;
  writeAudit(command: UpdateFactCommand, actor: Actor): Promise<void>;
};

export type UpdateFactStore = {
  transaction<T>(callback: (transaction: UpdateFactTransaction) => Promise<T>): Promise<T>;
};

export type UpdateFactResult = { projectId: string; assertionId: string; projectRevision: number; valueVersion: number };

export async function updateFactCommand(store: UpdateFactStore, actor: Actor, input: unknown): Promise<UpdateFactResult> {
  const command = UpdateFactCommandSchema.parse(input);
  return store.transaction(async (transaction) => {
    // 先鉴权再校验幂等：未授权者即使拿到已知 commandId 也不能读到更新结果。
    const project = await transaction.findProjectAccess(command.projectId);
    authorizeProject(actor, project, "EDIT");

    const previous = await transaction.findCommand(command.commandId);
    if (previous) return previous;

    const advanced = await transaction.compareAndAdvanceProject(command.projectId, command.expectedProjectRevision);
    if (!advanced) {
      throw new DomainError("PROJECT_REVISION_CONFLICT", "项目已被其他页面更新，请重新载入后比较差异。", { retryable: true });
    }

    const nextValueVersion = command.expectedProjectRevision + 1;
    await transaction.replaceCurrentAssertion(command, nextValueVersion);
    await transaction.invalidateCurrentConfirmations(command);
    await transaction.invalidateCurrentDrafts(command.projectId);
    await transaction.writeAudit(command, actor);

    return {
      projectId: command.projectId,
      assertionId: command.assertionId,
      projectRevision: command.expectedProjectRevision + 1,
      valueVersion: nextValueVersion,
    };
  });
}
