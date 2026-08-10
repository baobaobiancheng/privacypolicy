import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Header,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { DraftPlan } from "@/src/domain/draft/export-plan";
import type { GeneratedPolicyDraft } from "@/src/ai/deepseek";
import { parseMarkdownBlocks } from "@/src/documents/markdown";

export type DraftMetadata = {
  operatorName: string;
  productName: string;
  productVersion: string;
  contentVersion: string;
  contentHash: string;
  model?: string;
};

export async function renderDraftDocx(plan: DraftPlan, metadata: DraftMetadata, generatedDraft?: GeneratedPolicyDraft): Promise<Buffer> {
  const generatedAppendix = generatedDraft
    ? [
      ...generatedDraft.assertionIds.map((assertionId) => new Paragraph({
        children: [
          new TextRun({ text: "Markdown 溯源：", bold: true, color: "A45C00" }),
          new TextRun({ text: `断言：${assertionId}；待律师复核`, color: "6D756F" }),
        ],
      })),
      ...generatedDraft.openItems.map((item) => new Paragraph({
        children: [
          new TextRun({ text: `模型待办：${item.assertionId}；`, bold: true, color: "A45C00" }),
          new TextRun({ text: item.reason, color: "6D756F" }),
        ],
      })),
      ...(generatedDraft.unmatchedReferences.length > 0
        ? [new Paragraph({
          children: [
            new TextRun({ text: "未匹配的模型溯源标记：", bold: true, color: "A45C00" }),
            new TextRun({ text: `${generatedDraft.unmatchedReferences.join("、")}；请律师复核正文事实。`, color: "6D756F" }),
          ],
        })]
        : []),
    ]
    : [];
  const body = [
    ...(generatedDraft ? [] : [
      new Paragraph({ text: `${metadata.productName} 隐私政策`, heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: "工作草稿 · 律师复核前", bold: true, color: "A45C00" })] }),
      new Paragraph(`本政策适用于${metadata.operatorName}提供的${metadata.productName} ${metadata.productVersion}。`),
    ]),
    ...(generatedDraft
      ? [
        new Paragraph({ children: [new TextRun({ text: "AI 辅助生成 · Markdown · 待律师复核", bold: true, color: "A45C00" })] }),
        ...parseMarkdownBlocks(generatedDraft.markdown).map((block) => new Paragraph({
          children: [new TextRun({ text: block.text, italics: block.type === "quote" })],
          heading: block.type === "title" ? HeadingLevel.TITLE : block.type === "heading1" ? HeadingLevel.HEADING_1 : block.type === "heading2" ? HeadingLevel.HEADING_2 : undefined,
          bullet: block.type === "bullet" ? { level: 0 } : undefined,
        })),
      ]
      : [
        new Paragraph({ text: "我们如何收集和使用个人信息", heading: HeadingLevel.HEADING_1 }),
        ...plan.body.map((node) => new Paragraph({
          children: [
            new TextRun({ text: node.text }),
            new TextRun({ text: `  [${node.assertionId}]`, color: "708078", size: 16 }),
          ],
        })),
      ]),
    new Paragraph({ text: "律师复核附录", heading: HeadingLevel.HEADING_1 }),
    ...(plan.reviewAppendix.length > 0
      ? plan.reviewAppendix.map((node) => new Paragraph({
        children: [
          new TextRun({ text: `${node.text} `, bold: true, color: "A45C00" }),
          new TextRun({ text: `断言：${node.assertionId}；证据：${node.evidenceIds.join(",") || "待补充"}`, color: "6D756F" }),
        ],
      }))
      : []),
    ...generatedAppendix,
    ...(plan.reviewAppendix.length === 0 && generatedAppendix.length === 0 ? [new Paragraph("当前没有待复核占位符。")] : []),
    new Paragraph({ text: `内容版本：${metadata.contentVersion} · ${metadata.contentHash}${metadata.model ? ` · 模型：${metadata.model}` : ""}`, style: "Caption" }),
  ];

  const document = new Document({
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "知证 · 工作草稿", color: "708078", size: 16 })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "律师复核前 · 第 " }), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun({ text: " 页" })] })],
        }),
      },
      children: body,
    }],
  });

  return Packer.toBuffer(document);
}
