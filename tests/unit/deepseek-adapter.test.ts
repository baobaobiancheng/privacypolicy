import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePolicyDraft, POLICY_SECTION_TITLES, type PolicyGenerationInput } from "@/src/ai/deepseek";

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

const completeMarkdown = `# 地图隐私政策\n\n${POLICY_SECTION_TITLES.map((title, index) => `## ${index + 1}. ${title}\n本章节基于已填写事实生成，供法务继续编辑使用。\n<!-- assertions: ${index === 1 ? "navigation.location" : ""} -->`).join("\n\n")}`;

describe("DeepSeek adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.POLICY_MIN_VISIBLE_CHARACTERS;
  });

  it("requests Markdown and returns the validated document", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.POLICY_MIN_VISIBLE_CHARACTERS = "100";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: completeMarkdown } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePolicyDraft(input);

    expect(result.markdown).toContain("## 9.");
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      body: expect.stringContaining('"thinking":{"type":"disabled"}'),
    }));
    const requestCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const requestBody = JSON.parse(requestCall[1].body as string) as { messages: Array<{ content: string }> };
    expect(requestBody.messages[1].content).toContain("THIRD_PARTY_FACTS_STATUS:\nCUSTOMER_TEXT_PROVIDED");
  });

  it("expands a short first draft and only returns a policy above the configured floor", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.POLICY_MIN_VISIBLE_CHARACTERS = "1000";
    const expandedMarkdown = completeMarkdown.replace(
      "本章节基于已填写事实生成，供法务继续编辑使用。",
      `本章节基于已填写事实生成，供法务继续编辑使用。${"补充说明".repeat(320)}`,
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: completeMarkdown } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: expandedMarkdown } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePolicyDraft(input);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.markdown.length).toBeGreaterThan(1000);
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
