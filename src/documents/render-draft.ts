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
  const body = [
    ...(generatedDraft ? [] : [
      new Paragraph({ text: `${metadata.productName} 隐私政策`, heading: HeadingLevel.TITLE }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "隐私政策草稿", bold: true, color: "666666", size: 18 })] }),
      new Paragraph(`本政策适用于${metadata.operatorName}提供的${metadata.productName} ${metadata.productVersion}。`),
    ]),
    ...(generatedDraft
      ? [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "隐私政策草稿", bold: true, color: "666666", size: 18 })] }),
        ...parseMarkdownBlocks(generatedDraft.markdown).map((block) => new Paragraph({
          children: [new TextRun({ text: block.text, italics: block.type === "quote", color: block.type === "quote" ? "555555" : "222222" })],
          heading: block.type === "title" ? HeadingLevel.TITLE : block.type === "heading1" ? HeadingLevel.HEADING_1 : block.type === "heading2" ? HeadingLevel.HEADING_2 : undefined,
          bullet: block.type === "bullet" ? { level: 0 } : undefined,
          alignment: block.type === "paragraph" ? AlignmentType.JUSTIFIED : undefined,
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
  ];

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: "等线", size: 21, color: "222222" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 420, after: 160 } },
        },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "等线", size: 36, bold: true, color: "222222" },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 360 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "等线", size: 28, bold: true, color: "222222" },
          paragraph: { spacing: { before: 360, after: 180 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "等线", size: 24, bold: true, color: "222222" },
          paragraph: { spacing: { before: 280, after: 140 }, keepNext: true },
        },
      ],
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${metadata.productName} · 隐私政策`, color: "777777", size: 16 })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第 ", color: "777777", size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: "777777", size: 16 }), new TextRun({ text: " 页", color: "777777", size: 16 })] })],
        }),
      },
      children: body,
    }],
  });

  return Packer.toBuffer(document);
}
