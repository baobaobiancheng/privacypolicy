import { describe, expect, it } from "vitest";
import { FormPayloadSchema } from "@/src/ai/deepseek";
import { getRequiredSupplementQuestions, getRuntimeSlotScenario, getSlotScenario, mapCnKnowledgePackage, mapSlotPackage } from "@/src/knowledge/map-cn";
import { evaluateFormalPolicyReadiness, resolveFieldAnswer } from "@/src/knowledge/readiness";

const base = FormPayloadSchema.parse({
  profile: {
    operatorName: "杭州示例科技有限公司", operatorContact: "杭州市示例路 1 号", productName: "示例地图", productVersion: "Android 1.0",
    contactEmail: "privacy@example.com", rightsEntry: "App-我的-隐私中心", rightsResponsePeriod: "15 个工作日内答复",
    minorProcessing: "不面向未成年人，发现后按规则处理", securityMeasures: "访问控制、传输加密和最小权限",
    incidentChannel: "隐私邮箱与 App 公告", policyEffectiveDate: "2026-08-13", policyUpdateNotice: "App 弹窗和政策页提示",
  },
  selected: ["navigation"], customFeatures: [], customDetails: {},
  activityDetails: { navigation: { purpose: "提供定位和路线规划" } },
  confirmedFields: ["navigation.0", "navigation.1", "navigation.2"], additionalNotes: "",
  supplementAnswers: Object.fromEntries(getRequiredSupplementQuestions({ selected: ["navigation"], customFeatures: [] })
    .map((question) => [question.id, { answer: "NO" as const, detail: "" }])),
});

describe("map local knowledge readiness", () => {
  it("uses a versioned map knowledge package with the reviewed primary source scope", () => {
    expect(mapCnKnowledgePackage.contentVersion).toBe("map-cn-v1.1.0");
    expect(mapCnKnowledgePackage.sources).toHaveLength(9);
    expect(mapCnKnowledgePackage.sources.map((item) => item.id)).toContain("REG-CORE-03");
    expect(mapSlotPackage.scenarios).toHaveLength(5);
    expect(getSlotScenario("background-location")?.sourceRefs).toContain("REF-MAP-AMAP:record-1-4");
    expect(JSON.stringify(getRuntimeSlotScenario("background-location"))).not.toMatch(/AMAP|BAIDU|sourceRefs/);
  });

  it("triggers neutral supplemental questions from selected functionality", () => {
    const navigation = getRequiredSupplementQuestions({ selected: ["navigation"], customFeatures: [] });
    expect(navigation.map((item) => item.id)).toEqual(expect.arrayContaining(["device-permissions", "third-party-services", "background-location", "user-control-paths"]));
    expect(new Set(navigation.map((item) => item.round))).toEqual(new Set([1, 2, 3]));
    const withThirdParty = getRequiredSupplementQuestions({
      selected: ["navigation"],
      customFeatures: [],
      supplementAnswers: { "third-party-services": { answer: "YES", detail: "示例 SDK", slots: {} } },
    });
    expect(withThirdParty.map((item) => item.id)).toContain("third-party-initialization");
  });

  it("treats unchecked information as omitted but still blocks an unknown supplemental answer", () => {
    expect(evaluateFormalPolicyReadiness(base).ready).toBe(true);
    const partiallySelected = evaluateFormalPolicyReadiness({ ...base, confirmedFields: ["navigation.0"] });
    expect(partiallySelected.ready).toBe(true);
    expect(partiallySelected.diagnostics.some((item) => item.target?.startsWith("field."))).toBe(false);
    const unknown = evaluateFormalPolicyReadiness({ ...base, supplementAnswers: { ...base.supplementAnswers, "background-location": { answer: "UNKNOWN", detail: "", slots: {} } } });
    expect(unknown.ready).toBe(false);
    expect(unknown.diagnostics.some((item) => item.code === "NEEDS_PRODUCT_OR_TECH")).toBe(true);
  });

  it("accepts an explicit no-processing decision and never treats it as an unanswered field", () => {
    const result = evaluateFormalPolicyReadiness({
      ...base,
      confirmedFields: ["navigation.0", "navigation.2"],
      fieldAnswers: { "navigation.0": "PROCESS", "navigation.1": "NOT_PROCESS", "navigation.2": "PROCESS" },
    });
    expect(result.ready).toBe(true);
    expect(result.diagnostics.some((item) => item.target === "field.navigation.origin")).toBe(false);
  });

  it("requires customer confirmation for every required slot and never accepts AI candidates as complete", () => {
    const slotScenario = getSlotScenario("third-party-services");
    expect(slotScenario).toBeDefined();
    const candidateSlots = Object.fromEntries(slotScenario!.slots.map((slot) => [slot.id, { value: `候选-${slot.label}`, status: "CANDIDATE" as const }]));
    const candidate = evaluateFormalPolicyReadiness({
      ...base,
      supplementAnswers: {
        ...base.supplementAnswers,
        "third-party-services": { answer: "YES", detail: "使用示例SDK", slots: candidateSlots },
        "third-party-initialization": { answer: "NO", detail: "", slots: {} },
      },
    });
    expect(candidate.ready).toBe(false);
    expect(candidate.diagnostics.some((item) => item.target?.includes("question.third-party-services.slot"))).toBe(true);

    const confirmedSlots = Object.fromEntries(slotScenario!.slots.map((slot) => [slot.id, { value: slot.inputType === "url" ? "https://example.com/privacy" : `已确认-${slot.label}`, status: "CONFIRMED" as const }]));
    const confirmed = evaluateFormalPolicyReadiness({
      ...base,
      supplementAnswers: {
        ...base.supplementAnswers,
        "third-party-services": { answer: "YES", detail: "使用示例SDK", slots: confirmedSlots },
        "third-party-initialization": { answer: "NO", detail: "", slots: {} },
      },
    });
    expect(confirmed.ready).toBe(true);
  });

  it("blocks generation when no personal-information field is checked as processed", () => {
    const noFields = evaluateFormalPolicyReadiness({
      ...base,
      confirmedFields: [],
      fieldAnswers: {},
    });
    expect(noFields.ready).toBe(false);
    expect(noFields.diagnostics.some((item) => item.target === "fields" && item.severity === "BLOCKING")).toBe(true);
  });

  it("resolves legacy index-based field ids to their stable key after content reorders", () => {
    // 旧数据用 `navigation.0` 记录“位置信息”，映射到稳定键 navigation.location。
    const legacy = evaluateFormalPolicyReadiness({ ...base, confirmedFields: ["navigation.0"], fieldAnswers: {} });
    expect(legacy.ready).toBe(true);
    expect(resolveFieldAnswer({ confirmedFields: ["navigation.0"], fieldAnswers: {} }, "navigation.location")).toBe("PROCESS");
    expect(resolveFieldAnswer({ confirmedFields: ["navigation.0"], fieldAnswers: {} }, "navigation.location")).toBe("PROCESS");
  });
});
