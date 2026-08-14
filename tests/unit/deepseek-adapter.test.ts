import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFormBeforeGeneration, extractSupplementSlots, generatePolicyDraft, POLICY_SECTION_TITLES, type PolicyGenerationInput } from "@/src/ai/deepseek";

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

const completeMarkdown = `# 地图隐私政策\n\n| 功能 | 信息 | 目的 |\n| --- | --- | --- |\n| 定位导航 | 位置信息 | 路线规划 |\n\n${POLICY_SECTION_TITLES.map((title, index) => `## ${index + 1}. ${title}\n本章节基于已填写事实生成，供法务继续编辑使用。\n<!-- assertions: ${index === 1 ? "navigation.location" : ""} -->`).join("\n\n")}`;

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

    expect(result.markdown).toContain("## 9.");
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      body: expect.stringContaining('"thinking":{"type":"disabled"}'),
    }));
    const requestCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const requestBody = JSON.parse(requestCall[1].body as string) as { messages: Array<{ content: string }>; max_tokens: number };
    expect(requestBody.messages[1].content).toContain("THIRD_PARTY_FACTS_STATUS:\nNO_CONFIRMED_FACTS");
    expect(requestBody.messages[1].content).not.toContain("定位 SDK，用于路线规划");
    expect(requestBody.max_tokens).toBe(65_536);
  });

  it("accepts a structurally complete short policy without a hidden expansion request", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: completeMarkdown } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePolicyDraft(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.markdown).not.toContain("<!-- assertions:");
    expect(result.markdown).toContain("## 9. 政策更新、联系我们及适用法律");
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

  it("extracts only allowlisted slot candidates without sending competitor provenance", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const detail = "产品仅在用户开始导航后持续定位，退出导航后立即停止。";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      questionId: "background-location",
      candidates: [
        { slotId: "trigger", value: "用户开始导航后", evidenceText: "用户开始导航后" },
        { slotId: "invented", value: "编造内容", evidenceText: "产品" },
      ],
    }) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractSupplementSlots("background-location", detail);

    expect(result.candidates).toEqual([{ slotId: "trigger", value: "用户开始导航后", evidenceText: "用户开始导航后" }]);
    const requestBody = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) as { messages: Array<{ content: string }> };
    const prompt = requestBody.messages.map((message) => message.content).join("\n");
    expect(prompt).not.toMatch(/sourceRefs|REF-MAP-AMAP|REF-MAP-BAIDU|高德|百度/);
  });

  it("uses a separate model preflight to expose semantic conflicts and bounded law keywords", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      issues: [{
        id: "retention-conflict",
        severity: "BLOCKING",
        category: "CONTRADICTION",
        title: "保存期限冲突",
        description: "同一类日志出现两个保存期限。",
        targetStep: "supplement",
        relatedPaths: ["supplementAnswers.storage-locations"],
        questionForUser: "请区分日志类型并确认期限。",
      }],
      lawKeywords: ["个人信息保护法", "地图导航 必要个人信息"],
    }) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeFormBeforeGeneration(input.form);

    expect(result.issues[0]).toMatchObject({ severity: "BLOCKING", targetStep: "supplement" });
    expect(result.lawKeywords).toEqual(["个人信息保护法", "地图导航 必要个人信息"]);
    const requestBody = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) as { max_tokens: number; messages: Array<{ content: string }> };
    expect(requestBody.max_tokens).toBe(8_192);
    expect(requestBody.messages[0].content).toContain("不修改客户答案");
  });
});
