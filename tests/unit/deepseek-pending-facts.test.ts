import { describe, expect, it } from "vitest";
import { POLICY_SECTION_TITLES, parsePolicyMarkdown } from "@/src/ai/deepseek";

function completeMarkdown(collectionParagraph: string) {
  return `# 行迹地图隐私政策\n\n${POLICY_SECTION_TITLES.map((title, index) => {
    const body = index === 1 ? collectionParagraph : "本章节内容来自已确认表单，待律师复核。\n<!-- assertions: -->";
    return `## ${index + 1}. ${title}\n${body}`;
  }).join("\n\n")}`;
}

describe("DeepSeek 待确认事实边界", () => {
  const allowed = new Set(["security.crash_log"]);
  const pending = [{ key: "security.crash_log", label: "崩溃日志" }];

  it("拒绝把待确认字段写成确定的处理事实", () => {
    const markdown = completeMarkdown("我们会处理崩溃日志以排查问题。\n<!-- assertions: security.crash_log -->");
    expect(() => parsePolicyMarkdown(markdown, allowed, pending)).toThrow(/未确认字段|占位符/);
  });

  it("允许使用稳定字段键的显式占位符", () => {
    const markdown = completeMarkdown("是否处理崩溃日志仍待确认：[[待确认:security.crash_log]]。\n<!-- assertions: security.crash_log -->");
    expect(parsePolicyMarkdown(markdown, allowed, pending).openItems).toEqual([]);
  });
});
