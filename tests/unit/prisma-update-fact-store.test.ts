import { describe, expect, it, vi } from "vitest";
import { createPrismaUpdateFactStore } from "@/src/data/prisma-update-fact-store";
import type { UpdateFactCommand } from "@/src/application/commands/update-fact";

function makeFakePrisma() {
  const factAssertionUpdateMany = vi.fn();
  const factAssertionCreate = vi.fn();
  const factAssertionFindMany = vi.fn();
  const confirmationUpdateMany = vi.fn();
  const tx = {
    factAssertion: { updateMany: factAssertionUpdateMany, create: factAssertionCreate, findMany: factAssertionFindMany },
    confirmation: { updateMany: confirmationUpdateMany },
  };
  const prisma = { $transaction: async (callback: (t: unknown) => Promise<unknown>) => callback(tx) };
  return { prisma, factAssertionUpdateMany, factAssertionCreate, factAssertionFindMany, confirmationUpdateMany };
}

const command: UpdateFactCommand = {
  commandId: "command-12345678",
  projectId: "project-a",
  expectedProjectRevision: 3,
  assertionId: "assertion-new-2",
  subjectKey: "activity:navigation",
  groupKey: "data-field:location",
  fieldKey: "location",
  value: "新值",
  originType: "CLIENT_ORIGINAL",
};

describe("Prisma 更新事实存储", () => {
  it("replaceCurrentAssertion 先按 tuple 退休当前行，再以新 assertionId 新建行", async () => {
    const { prisma, factAssertionUpdateMany, factAssertionCreate } = makeFakePrisma();
    const store = createPrismaUpdateFactStore(prisma as never);
    await store.transaction((t) => t.replaceCurrentAssertion(command, 4));

    expect(factAssertionUpdateMany).toHaveBeenCalledWith({
      where: { projectId: "project-a", subjectKey: "activity:navigation", groupKey: "data-field:location", fieldKey: "location", current: true },
      data: { current: false },
    });
    expect(factAssertionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: "assertion-new-2", current: true, valueVersion: 4, value: "新值" }),
    }));
  });

  it("invalidateCurrentConfirmations 按 tuple 查出所有版本行 id 再失效", async () => {
    const { prisma, factAssertionFindMany, confirmationUpdateMany } = makeFakePrisma();
    factAssertionFindMany.mockResolvedValue([{ id: "assertion-old" }, { id: "assertion-new" }]);
    const store = createPrismaUpdateFactStore(prisma as never);
    await store.transaction((t) => t.invalidateCurrentConfirmations(command));

    expect(factAssertionFindMany).toHaveBeenCalledWith({
      where: { projectId: "project-a", subjectKey: "activity:navigation", groupKey: "data-field:location", fieldKey: "location" },
      select: { id: true },
    });
    expect(confirmationUpdateMany).toHaveBeenCalledWith({
      where: { assertionId: { in: ["assertion-old", "assertion-new"] }, invalidatedAt: null },
      data: { invalidatedAt: expect.any(Date) },
    });
  });
});
