import { describe, expect, it } from "vitest";
import { updateFactCommand, type UpdateFactResult, type UpdateFactStore } from "@/src/application/commands/update-fact";
import type { Actor } from "@/src/application/authorization";

function fakeStore(options: { compareAndAdvance?: boolean } = {}) {
  const commands = new Map<string, UpdateFactResult>();
  let writes = 0;
  const store: UpdateFactStore = {
    transaction: async (callback) => callback({
      findProjectAccess: async () => ({ tenantId: "tenant-a", ownerId: "client-a", access: [{ userId: "client-a", role: "CLIENT_EDITOR" }] }),
      findCommand: async (commandId) => commands.get(commandId) ?? null,
      compareAndAdvanceProject: async () => options.compareAndAdvance ?? true,
      replaceCurrentAssertion: async () => { writes += 1; },
      invalidateCurrentConfirmations: async () => { writes += 1; },
      invalidateCurrentDrafts: async () => { writes += 1; },
      writeAudit: async (command) => {
        writes += 1;
        commands.set(command.commandId, { projectId: command.projectId, assertionId: command.assertionId, projectRevision: command.expectedProjectRevision + 1, valueVersion: command.expectedProjectRevision + 1 });
      },
    }),
  };
  return { store, writes: () => writes };
}

const actor: Actor = { userId: "client-a", tenantId: "tenant-a", role: "CLIENT_EDITOR" };
const command = {
  commandId: "command-12345678",
  projectId: "project-a",
  expectedProjectRevision: 3,
  assertionId: "assertion-a",
  subjectKey: "activity:navigation",
  groupKey: "data-field:location",
  fieldKey: "location",
  value: "实时位置",
  originType: "CLIENT_ORIGINAL" as const,
};

describe("事务事实命令", () => {
  it("重复 commandId 幂等，不重复写入副作用", async () => {
    const fake = fakeStore();
    const first = await updateFactCommand(fake.store, actor, command);
    const second = await updateFactCommand(fake.store, actor, command);
    expect(second).toEqual(first);
    expect(fake.writes()).toBe(4);
  });

  it("CAS 失败返回版本冲突", async () => {
    const fake = fakeStore({ compareAndAdvance: false });
    await expect(updateFactCommand(fake.store, actor, command)).rejects.toMatchObject({ code: "PROJECT_REVISION_CONFLICT" });
    expect(fake.writes()).toBe(0);
  });

  it("鉴权先于幂等重放：未授权 actor 即使带已知 commandId 也被拒绝", async () => {
    const commands = new Map<string, UpdateFactResult>();
    commands.set("command-12345678", { projectId: "project-a", assertionId: "assertion-a", projectRevision: 4, valueVersion: 4 });
    const store: UpdateFactStore = {
      transaction: async (callback) => callback({
        // 跨租户：actor 无权访问该项目。
        findProjectAccess: async () => ({ tenantId: "tenant-b", ownerId: "other-user", access: [] }),
        findCommand: async (commandId) => commands.get(commandId) ?? null,
        compareAndAdvanceProject: async () => true,
        replaceCurrentAssertion: async () => {},
        invalidateCurrentConfirmations: async () => {},
        invalidateCurrentDrafts: async () => {},
        writeAudit: async () => {},
      }),
    };
    // 若幂等重放在鉴权之前，这里会直接返回 previous；现在必须抛 PROJECT_FORBIDDEN。
    await expect(updateFactCommand(store, actor, command)).rejects.toMatchObject({ code: "PROJECT_FORBIDDEN" });
  });
});
