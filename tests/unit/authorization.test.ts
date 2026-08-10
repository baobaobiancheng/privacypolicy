import { describe, expect, it } from "vitest";
import { authorizeProject, type Actor } from "@/src/application/authorization";

const project = {
  tenantId: "tenant-a",
  ownerId: "client-a",
  access: [{ userId: "lawyer-a", role: "LAWYER_REVIEWER" as const }],
};

describe("项目授权边界", () => {
  it("同租户已分配律师可读和复核，但不能修改事实", () => {
    const lawyer: Actor = { userId: "lawyer-a", tenantId: "tenant-a", role: "LAWYER_REVIEWER" };
    expect(() => authorizeProject(lawyer, project, "READ")).not.toThrow();
    expect(() => authorizeProject(lawyer, project, "REVIEW")).not.toThrow();
    expect(() => authorizeProject(lawyer, project, "EDIT")).toThrowError(expect.objectContaining({ code: "PROJECT_FORBIDDEN" }));
  });

  it("跨租户即使猜中项目 ID 也被拒绝", () => {
    const actor: Actor = { userId: "lawyer-a", tenantId: "tenant-b", role: "LAWYER_REVIEWER" };
    expect(() => authorizeProject(actor, project, "READ")).toThrowError(expect.objectContaining({ code: "PROJECT_FORBIDDEN" }));
  });
});
