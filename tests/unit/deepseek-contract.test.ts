import { describe, expect, it } from "vitest";
import { FormPayloadSchema, ModelMarkdownSchema, POLICY_SECTION_TITLES, parsePolicyMarkdown } from "@/src/ai/deepseek";

describe("DeepSeek contract", () => {
  it("accepts a citation-bearing Markdown draft", () => {
    const markdown = `# 地图隐私政策\n\n${POLICY_SECTION_TITLES.map((title, index) => `## ${index + 1}. ${title}\n本章节内容待律师复核。\n<!-- assertions: ${index === 1 ? "navigation.location" : ""} -->`).join("\n\n")}`;
    const result = parsePolicyMarkdown(markdown, new Set(["navigation.location"]));
    expect(result.markdown).toContain("## 9.");
  });

  it("rejects Markdown with an incomplete section contract", () => {
    expect(() => parsePolicyMarkdown("# 标题\n\n## 1. 只有一个章节\n内容足够长但结构不完整。", new Set())).toThrow();
  });

  it("keeps the raw model contract as Markdown", () => {
    expect(ModelMarkdownSchema.safeParse("# 标题\n\n" + "正文。".repeat(60)).success).toBe(true);
  });

  it("requires the complete form payload before a model call", () => {
    const result = FormPayloadSchema.safeParse({
      profile: { operatorName: "主体", operatorContact: "地址", productName: "地图", productVersion: "1.0", contactEmail: "", rightsEntry: "App 内隐私中心", rightsResponsePeriod: "15 天", minorProcessing: "不处理", securityMeasures: "加密", incidentChannel: "邮箱", policyEffectiveDate: "2026-08-10", policyUpdateNotice: "App 公告" },
      selected: ["navigation"],
      customFeatures: [],
      customDetails: {},
      activityDetails: { navigation: { purpose: "导航", retention: "导航结束后" } },
      confirmedFields: [],
      additionalNotes: "",
    });
    expect(result.success).toBe(false);
  });
});
