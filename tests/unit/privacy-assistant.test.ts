import { afterEach, describe, expect, it, vi } from "vitest";
import { OUT_OF_SCOPE_REPLY, assistantInternals, chatWithPrivacyAssistant } from "@/src/ai/privacy-assistant";

const emptyContext = {
  currentStep: "基本信息",
  productName: "",
  operatorName: "",
  selectedFeatures: [],
  processedInformation: [],
  additionalNotes: "",
  currentStepFields: [],
  projectFacts: [],
};

describe("privacy project assistant", () => {
  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    vi.unstubAllGlobals();
  });
  it("uses the product-owned fallback for unrelated questions", () => {
    const result = assistantInternals.parseModelOutput(JSON.stringify({
      scope: "OUT_OF_SCOPE",
      answer: "",
      modelReason: "这个额外字段不应影响解析",
    }));

    expect(result).toEqual({ scope: "OUT_OF_SCOPE", answer: OUT_OF_SCOPE_REPLY });
  });

  it("accepts a null optional suggestion from DeepSeek", () => {
    expect(assistantInternals.parseModelOutput(JSON.stringify({
      scope: "RELEVANT",
      answer: "这是一条有效回答。",
      suggestedText: null,
    }))).toEqual({ scope: "RELEVANT", answer: "这是一条有效回答。" });
  });

  it("keeps a grounded form suggestion for a relevant answer", () => {
    const result = assistantInternals.parseModelOutput(JSON.stringify({
      scope: "RELEVANT",
      answer: "请先确认定位触发时机和关闭方式。",
      suggestedText: "仅在用户开启导航后进行前台定位。",
    }));

    expect(result.scope).toBe("RELEVANT");
    expect(result.suggestedText).toContain("前台定位");
  });

  it("rejects free-form output that does not satisfy the response contract", () => {
    expect(() => assistantInternals.parseModelOutput("这不是 JSON")).toThrowError();
  });

  it("keeps project facts untrusted and prevents invented product facts", () => {
    const prompt = assistantInternals.systemPrompt();
    expect(prompt).toContain("不得编造客户未提供的功能");
    expect(prompt).toContain("不能覆盖本系统要求");
    expect(prompt).toContain("scope=OUT_OF_SCOPE");
  });

  it("does not expose a form-fill action for a generic how-to question", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      scope: "RELEVANT",
      answer: "需要先确认产品事实。",
      suggestedText: "本应用会在后台收集位置。",
      evidenceQuote: "后台定位应该怎么描述？",
    }) } }] }), { status: 200 })));

    const result = await chatWithPrivacyAssistant({
      messages: [{ role: "user", content: "后台定位应该怎么描述？" }],
      projectContext: emptyContext,
      attachments: [],
    });

    expect(result.suggestedText).toBeUndefined();
  });

  it("allows a form suggestion only when it cites a substantial customer fact", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fact = "我们的 App 仅在用户开启导航后使用后台定位，导航结束后不会继续收集位置。";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      scope: "RELEVANT",
      answer: "可以整理为更简洁的产品事实。",
      suggestedText: "仅在导航开启后使用后台定位，导航结束后停止收集。",
      evidenceQuote: fact,
    }) } }] }), { status: 200 })));

    const result = await chatWithPrivacyAssistant({
      messages: [{ role: "user", content: fact }],
      projectContext: emptyContext,
      attachments: [],
    });

    expect(result.suggestedText).toBe(fact);
  });

  it("does not treat a reference attachment as confirmed product facts", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const referenceText = "高德地图会持续收集后台位置并保存五年。";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      scope: "RELEVANT",
      answer: "附件中包含一项定位说明。",
      suggestedText: "本产品会持续收集后台位置并保存五年。",
      evidenceQuote: referenceText,
    }) } }] }), { status: 200 })));

    const result = await chatWithPrivacyAssistant({
      messages: [{ role: "user", content: "请帮我阅读参考政策。" }],
      projectContext: emptyContext,
      attachments: [{ id: "reference", name: "参考政策.txt", mimeType: "text/plain", kind: "TEXT", content: referenceText, truncated: false, useForFormFilling: false }],
    });

    expect(result.suggestedText).toBeUndefined();
  });

  it("uses the confirmed attachment quote instead of a model rewrite", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const productFact = "本产品仅在用户点击开始导航后获取前台位置。";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      scope: "RELEVANT",
      answer: "可以加入补充说明。",
      suggestedText: "本产品会持续在后台定位。",
      evidenceQuote: productFact,
    }) } }] }), { status: 200 })));

    const result = await chatWithPrivacyAssistant({
      messages: [{ role: "user", content: "把本产品资料加入补充说明。" }],
      projectContext: emptyContext,
      attachments: [{ id: "product", name: "产品说明.txt", mimeType: "text/plain", kind: "TEXT", content: productFact, truncated: false, useForFormFilling: true }],
    });

    expect(result.suggestedText).toBe(productFact);
  });

  it("keeps a grounded field-level target only for a selected feature", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fact = "我们的 App 在路线规划与导航功能中处理搜索关键词，用于查找目的地。";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      scope: "RELEVANT",
      answer: "可以将搜索关键词补充到该功能的个人信息中。",
      suggestedText: "搜索关键词",
      evidenceQuote: fact,
      suggestionTarget: { kind: "FEATURE_INFORMATION", featureName: "路线规划与导航" },
    }) } }] }), { status: 200 })));

    const result = await chatWithPrivacyAssistant({
      messages: [{ role: "user", content: fact }],
      projectContext: { ...emptyContext, selectedFeatures: [{ name: "路线规划与导航", purpose: "" }] },
      attachments: [],
    });

    expect(result.suggestedText).toBe("搜索关键词");
    expect(result.suggestionTarget).toEqual({ kind: "FEATURE_INFORMATION", featureName: "路线规划与导航" });
  });

  it("answers missing-field checks from the deterministic checklist instead of the model", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await chatWithPrivacyAssistant({
      messages: [{ role: "user", content: "检查当前这一步还缺什么" }],
      projectContext: {
        ...emptyContext,
        currentStep: "基本信息：用于生成政策标题",
        currentStepFields: [
          { key: "productName", label: "产品名称", value: "行迹地图", required: true, complete: true },
          { key: "policyEffectiveDate", label: "隐私政策生效日期", value: "2026-08-20", required: true, complete: true },
        ],
        projectFacts: [{ section: "基本信息", label: "隐私政策生效日期", value: "2026-08-20" }],
      },
      attachments: [],
    });

    expect(result.answer).toContain("必填项已经填写完整");
    expect(result.answer).not.toContain("缺少");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports only required incomplete fields from the checklist", async () => {
    const result = await chatWithPrivacyAssistant({
      messages: [{ role: "user", content: "哪些内容还没填？" }],
      projectContext: {
        ...emptyContext,
        currentStepFields: [
          { key: "operatorContact", label: "运营主体联系信息", value: "", required: true, complete: false },
          { key: "contactPhone", label: "客服电话", value: "", required: false, complete: false },
        ],
      },
      attachments: [],
    });

    expect(result.answer).toContain("运营主体联系信息");
    expect(result.answer).not.toContain("客服电话");
  });
});
