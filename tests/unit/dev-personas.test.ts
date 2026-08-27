import { describe, expect, it } from "vitest";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { assertDevPersonaSwitchAllowed } from "@/src/auth/session";

describe("development persona deployment gate", () => {
  it.each(["development", "test"] as const)("allows personas in %s", (environment) => {
    expect(isDevPersonaEnabled(environment, undefined)).toBe(true);
  });

  it("fails closed in production by default", () => {
    expect(isDevPersonaEnabled("production", undefined)).toBe(false);
    expect(() => assertDevPersonaSwitchAllowed("production", undefined))
      .toThrowError("当前部署尚未接入登录认证。");
  });

  it("allows an explicit temporary internal-demo opt-in in production", () => {
    expect(isDevPersonaEnabled("production", "1")).toBe(true);
    expect(() => assertDevPersonaSwitchAllowed("production", "1")).not.toThrow();
  });

  it.each(["true", "yes", "0", " 1 "])("rejects ambiguous opt-in value %s", (value) => {
    expect(isDevPersonaEnabled("production", value)).toBe(false);
  });
});
