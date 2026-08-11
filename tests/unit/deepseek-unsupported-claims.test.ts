import { describe, expect, it } from "vitest";
import { POLICY_SECTION_TITLES, parsePolicyMarkdown } from "@/src/ai/deepseek";

function policyWithThirdPartyParagraph(paragraph: string) {
  return `# 行迹地图隐私政策\n\n${POLICY_SECTION_TITLES.map((title, index) => `## ${index + 1}. ${title}\n${index === 4 ? paragraph : "本章节内容待律师复核。"}\n<!-- assertions: ${index === 4 ? "additionalNotes" : ""} -->`).join("\n\n")}`;
}

describe("DeepSeek 未经确认的全面承诺", () => {
  it("拒绝从单个 SDK 信息推导不向任何第三方共享", () => {
    const markdown = policyWithThirdPartyParagraph("我们使用高德定位 SDK。除法律另有规定外，我们不会向第三方共享您的个人信息。");
    expect(() => parsePolicyMarkdown(markdown, new Set(["additionalNotes"]), [], "使用高德定位 SDK，不向境外传输数据。"))
      .toThrow(/第三方否定承诺/);
  });

  it("允许客户原文已经明确确认的否定事实", () => {
    const markdown = policyWithThirdPartyParagraph("我们不会向第三方共享您的个人信息。");
    expect(() => parsePolicyMarkdown(markdown, new Set(["additionalNotes"]), [], "客户确认：不会向第三方共享个人信息。"))
      .not.toThrow();
  });
});
