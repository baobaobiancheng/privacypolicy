import { describe, expect, it } from "vitest";
import { authorizeProject, type Actor } from "@/src/application/authorization";

const project = {
  tenantId: "tenant-a",
  ownerId: "client-a",
  access: [{ userId: "product-a", role: "PRODUCT_TECH" as const }],
};

describe("project authorization", () => {
  it("allows the owner to read, edit and export", () => {
    const owner: Actor = { userId: "client-a", tenantId: "tenant-a", role: "CLIENT_EDITOR" };
    expect(() => authorizeProject(owner, project, "READ")).not.toThrow();
    expect(() => authorizeProject(owner, project, "EDIT")).not.toThrow();
    expect(() => authorizeProject(owner, project, "EXPORT")).not.toThrow();
  });

  it("allows an explicitly granted product user to edit", () => {
    const product: Actor = { userId: "product-a", tenantId: "tenant-a", role: "PRODUCT_TECH" };
    expect(() => authorizeProject(product, project, "EDIT")).not.toThrow();
  });

  it("rejects cross-tenant access without making it retryable", () => {
    const actor: Actor = { userId: "client-a", tenantId: "tenant-b", role: "CLIENT_EDITOR" };
    expect(() => authorizeProject(actor, project, "READ")).toThrowError(expect.objectContaining({ code: "PROJECT_FORBIDDEN", retryable: false }));
  });
});
