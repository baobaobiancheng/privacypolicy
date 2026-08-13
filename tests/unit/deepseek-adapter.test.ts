import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePolicyDraft, type PolicyGenerationInput } from "@/src/ai/deepseek";

const input: PolicyGenerationInput = {
  form: {
    profile: {
      operatorName: "主体",
      operatorContact: "地址",
      productName: "地图",
      productVersion: "1.0",
      contactEmail: "privacy@example.com",
      rightsEntry: "App 内隐私中心",
      rightsResponsePeriod: "15 天",
      minorProcessing: "不处理",
      securityMeasures: "加密",
      incidentChannel: "邮箱",
      policyEffectiveDate: "2026-08-10",
      policyUpdateNotice: "App 公告",
    },
    selected: ["navigation"],
    customFeatures: [],
    customDetails: {},
    activityDetails: { navigation: { purpose: "导航", retention: "导航结束后" } },
    confirmedFields: ["navigation.0"],
    additionalNotes: "",
    supplementAnswers: { "third-party-services": { answer: "YES", detail: "定位 SDK，用于路线规划" } },
  },
  contentVersion: "map-v1.0.0",
  contentHash: "sha256:test",
  selectedFeatures: [{ key: "navigation", title: "定位和导航", summary: "路线规划", fields: [{ key: "location", label: "位置信息" }] }],
  referenceStructure: [{ id: "overview", title: "政策概述", summary: "主体和版本" }],
  allowedFactKeys: ["navigation.location", "operatorName"],
};

const completeMarkdown = `# 地图隐私政策\n\n${["政策概述", "我们如何收集和使用个人信息", "保存期限", "用户权利", "委托、共享与第三方", "安全措施", "未成年人信息", "政策更新与联系我们"].map((title, index) => `## ${index + 1}. ${title}\n待律师复核。\n<!-- assertions: ${index === 1 ? "navigation.location" : ""} -->`).join("\n\n")}`;

describe("DeepSeek adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("requests Markdown and returns the validated document", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: completeMarkdown } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePolicyDraft(input);

    expect(result.markdown).toContain("## 8.");
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      body: expect.stringContaining('"thinking":{"type":"disabled"}'),
    }));
    const requestCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const requestBody = JSON.parse(requestCall[1].body as string) as { messages: Array<{ content: string }> };
    expect(requestBody.messages[1].content).toContain("THIRD_PARTY_FACTS_STATUS:\nCUSTOMER_TEXT_PROVIDED");
  });

  it("classifies an aborted response body as a service timeout instead of invalid model output", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new DOMException("aborted", "AbortError"); },
    })));

    await expect(generatePolicyDraft(input)).rejects.toMatchObject({
      code: "MODEL_REQUEST_FAILED",
      message: expect.stringContaining("超时"),
    });
  });

  it("rejects a model citation that is not in the form field allowlist", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const invalid = completeMarkdown.replace("<!-- assertions:  -->", "<!-- assertions: invented-field -->");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: invalid } }] }), { status: 200 })));

    await expect(generatePolicyDraft(input)).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
  });

  it("rejects pending facts so a formal candidate cannot contain placeholders", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: completeMarkdown } }] }), { status: 200 })));

    await expect(generatePolicyDraft({
      ...input,
      allowedFactKeys: [...input.allowedFactKeys, "navigation.origin"],
      pendingFacts: [{ key: "navigation.origin", label: "出发地" }],
      selectedFeatures: [{
        ...input.selectedFeatures[0],
        fields: [...input.selectedFeatures[0].fields, { key: "origin", label: "出发地", confirmed: false }],
      }],
    })).rejects.toMatchObject({ code: "EXPORT_BLOCKED" });
  });
});
