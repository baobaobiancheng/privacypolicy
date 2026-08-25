import { describe, expect, it } from "vitest";
import { DomainError } from "@/src/domain/errors";
import { createEntityId, isEntityId } from "@/src/domain/ids";
import { requireEntityId } from "@/src/http/route-params";
import { FORM_SCHEMA_VERSION, ProjectFormDataSchema, calculateProjectProgress } from "@/src/workspace/contract";

describe("core v2 identifiers", () => {
  it("creates prefixed UUIDv7 project IDs", () => {
    const id = createEntityId("prj", 1_775_000_000_000);
    expect(id).toMatch(/^prj_[0-9a-f-]+$/);
    expect(isEntityId(id, "prj")).toBe(true);
    expect(id.split("_")[1]?.[14]).toBe("7");
  });

  it("does not accept one entity prefix as another", () => {
    expect(isEntityId(createEntityId("gen"), "rpt")).toBe(false);
  });

  it("rejects route identifiers with the wrong resource prefix", () => {
    const projectId = createEntityId("prj");
    expect(requireEntityId(projectId, "prj", "项目 ID")).toBe(projectId);
    expect(() => requireEntityId(projectId, "rpt", "报告 ID")).toThrowError(DomainError);
  });

  it("creates unique IDs for calls in the same millisecond", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createEntityId("req", 1_775_000_000_000)));
    expect(ids.size).toBe(50);
  });
});

describe("canonical project form", () => {
  it("creates an empty versioned form with deterministic defaults", () => {
    const form = ProjectFormDataSchema.parse({ schemaVersion: FORM_SCHEMA_VERSION });
    expect(form.schemaVersion).toBe("privacy-form-v2.0.0");
    expect(form.processingActivities).toEqual([]);
    expect(form.storageAndSecurity).toEqual({});
  });

  it("rejects removed scope fields", () => {
    expect(() => ProjectFormDataSchema.parse({ schemaVersion: FORM_SCHEMA_VERSION, scopeAnswers: { map: true } })).toThrow();
  });

  it("rejects per-feature retention", () => {
    expect(() => ProjectFormDataSchema.parse({
      schemaVersion: FORM_SCHEMA_VERSION,
      processingActivities: [{
        featureKey: "navigation", title: "定位与导航", kind: "BASIC",
        informationItems: ["位置信息"], informationOther: [], purposes: ["路线规划"], purposeOther: "", retention: "30天",
      }],
    })).toThrow();
  });

  it("calculates progress only from canonical sections", () => {
    const form = ProjectFormDataSchema.parse({
      schemaVersion: FORM_SCHEMA_VERSION,
      profile: { operatorName: "公司", productName: "地图", productVersion: "1.0", policyEffectiveDate: "2026-08-24" },
      processingActivities: [{
        featureKey: "navigation", title: "定位与导航", kind: "BASIC",
        informationItems: ["位置信息"], informationOther: [], purposes: ["路线规划"], purposeOther: "",
      }],
    });
    expect(calculateProjectProgress(form)).toBe(33);
  });
});

describe("domain error retry contract", () => {
  it("does not mark invalid customer input as retryable", () => {
    expect(new DomainError("FIELD_INVALID", "invalid").retryable).toBe(false);
  });

  it("marks revision conflicts as retryable", () => {
    expect(new DomainError("PROJECT_REVISION_CONFLICT", "stale").retryable).toBe(true);
  });
});
