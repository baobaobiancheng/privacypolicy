import { describe, expect, it } from "vitest";
import { FormPayloadSchema } from "@/src/ai/deepseek";
import { getRequiredSupplementQuestions, mapCnKnowledgePackage } from "@/src/knowledge/map-cn";
import { evaluateFormalPolicyReadiness } from "@/src/knowledge/readiness";

const base = FormPayloadSchema.parse({
  profile: {
    operatorName: "杭州示例科技有限公司", operatorContact: "杭州市示例路 1 号", productName: "示例地图", productVersion: "Android 1.0",
    contactEmail: "privacy@example.com", rightsEntry: "App-我的-隐私中心", rightsResponsePeriod: "15 个工作日内答复",
    minorProcessing: "不面向未成年人，发现后按规则处理", securityMeasures: "访问控制、传输加密和最小权限",
    incidentChannel: "隐私邮箱与 App 公告", policyEffectiveDate: "2026-08-13", policyUpdateNotice: "App 弹窗和政策页提示",
  },
  selected: ["navigation"], customFeatures: [], customDetails: {},
  activityDetails: { navigation: { purpose: "提供定位和路线规划", retention: "导航结束后删除或去标识化" } },
  confirmedFields: ["navigation.0", "navigation.1", "navigation.2"], additionalNotes: "",
  scopeAnswers: { "single-product": true, "map-primary": true, "single-category": true, "no-cross-border": true },
  supplementAnswers: {
    "third-party-services": { answer: "NO", detail: "" },
    "background-location": { answer: "NO", detail: "" },
  },
});

describe("map local knowledge readiness", () => {
  it("uses a versioned map knowledge package with the reviewed primary source scope", () => {
    expect(mapCnKnowledgePackage.contentVersion).toBe("map-cn-v1.0.0");
    expect(mapCnKnowledgePackage.sources).toHaveLength(9);
    expect(mapCnKnowledgePackage.sources.map((item) => item.id)).toContain("REG-CORE-03");
  });

  it("triggers neutral supplemental questions from selected functionality", () => {
    expect(getRequiredSupplementQuestions({ selected: ["navigation"], customFeatures: [] }).map((item) => item.id)).toEqual(["third-party-services", "background-location"]);
    expect(getRequiredSupplementQuestions({ selected: ["discovery"], customFeatures: [] }).map((item) => item.id)).toEqual(["third-party-services", "history-and-favorites", "personalized-content"]);
  });

  it("blocks generation when a customer fact is unconfirmed or a technical answer is unknown", () => {
    expect(evaluateFormalPolicyReadiness(base).ready).toBe(true);
    const unconfirmed = evaluateFormalPolicyReadiness({ ...base, confirmedFields: ["navigation.0"] });
    expect(unconfirmed.ready).toBe(false);
    expect(unconfirmed.diagnostics.some((item) => item.target === "field.navigation.origin")).toBe(true);
    const unknown = evaluateFormalPolicyReadiness({ ...base, supplementAnswers: { ...base.supplementAnswers, "background-location": { answer: "UNKNOWN", detail: "" } } });
    expect(unknown.ready).toBe(false);
    expect(unknown.diagnostics.some((item) => item.code === "NEEDS_PRODUCT_OR_TECH")).toBe(true);
  });
});
