import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePolicyDraft, type PolicyGenerationInput } from "@/src/ai/deepseek";

const input: PolicyGenerationInput = {
  form: {
    profile: { operatorName: "主体", operatorContact: "地址", productName: "地图", productVersion: "1.0", contactEmail: "privacy@example.com", rightsEntry: "App 内", rightsResponsePeriod: "15 天", minorProcessing: "不面向", securityMeasures: "加密", incidentChannel: "邮箱", policyEffectiveDate: "2026-08-10", policyUpdateNotice: "公告" },
    selected: ["navigation"], customFeatures: [], customDetails: {}, activityDetails: { navigation: { purpose: "导航" } }, confirmedFields: [], additionalNotes: "",
  },
  contentVersion: "map-v1", contentHash: "sha256:test", selectedFeatures: [], referenceStructure: [], allowedFactKeys: [], confirmedFactKeys: [], pendingFacts: [],
};

describe("DeepSeek 失败时不隐藏式重复计费", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("响应结构无效时只请求一次，由用户决定是否重试", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generatePolicyDraft(input)).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
