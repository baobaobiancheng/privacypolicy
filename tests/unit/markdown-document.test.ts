import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { cleanMarkdownText, parseMarkdownBlocks, parseMarkdownInline } from "@/src/documents/markdown";
import { renderDraftDocx } from "@/src/documents/render-draft";

describe("policy Markdown document contract", () => {
  it("preserves tables, hierarchy, emphasis and real hyperlinks for Word rendering", () => {
    const markdown = `# 示例隐私政策

## 1. 基本功能与扩展功能

这是**重点说明**，请查看[第三方政策](https://example.com/privacy)。

| 功能 | 信息 | 目的 |
| --- | --- | --- |
| 定位导航 | 位置信息 | 路线规划 |

1. 第一项权利
- 第二项说明`;
    const blocks = parseMarkdownBlocks(markdown);

    expect(blocks.map((block) => block.type)).toEqual(["title", "heading1", "paragraph", "table", "numbered", "bullet"]);
    expect(blocks.find((block) => block.type === "table")).toMatchObject({ headers: ["功能", "信息", "目的"], rows: [["定位导航", "位置信息", "路线规划"]] });
    expect(parseMarkdownInline("这是**重点**和[链接](https://example.com)")).toEqual([
      { text: "这是" },
      { text: "重点", bold: true },
      { text: "和" },
      { text: "链接", link: "https://example.com" },
    ]);
    expect(cleanMarkdownText("**重点** [链接](https://example.com)")).toBe("重点 链接");
  });

  it("renders an updateable Word table of contents, tables and hyperlinks", async () => {
    const markdown = `# 示例隐私政策

## 1. 基本功能与扩展功能

这是**重点说明**，请查看[第三方政策](https://example.com/privacy)。

| 功能 | 信息 | 目的 |
| --- | --- | --- |
| 定位导航 | 位置信息 | 路线规划 |`;
    const buffer = await renderDraftDocx({ body: [], reviewAppendix: [], blockingCodes: [], riskCodes: [], watermark: "工作草稿 · 律师复核前" }, {
      operatorName: "示例公司",
      productName: "示例地图",
      productVersion: "1.0",
      policyEffectiveDate: "2026-08-14",
      generatedAt: "2026-08-14",
      contentVersion: "map-v1.0.0",
      contentHash: "sha256:test",
    }, { markdown, model: "test-model", assertionIds: [], openItems: [], unmatchedReferences: [] });
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const relationshipsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");

    expect(documentXml).toContain("TOC \\h \\o &quot;1-3&quot;");
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("重点说明");
    expect(relationshipsXml).toContain("https://example.com/privacy");
  });
});
