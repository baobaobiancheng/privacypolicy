import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  Header,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { DraftPlan } from "@/src/domain/draft/export-plan";
import type { GeneratedPolicyDraft } from "@/src/ai/deepseek";
import { parseMarkdownBlocks, parseMarkdownInline, type MarkdownBlock } from "@/src/documents/markdown";

export type DraftMetadata = {
  operatorName: string;
  productName: string;
  productVersion: string;
  contentVersion: string;
  contentHash: string;
  policyEffectiveDate?: string;
  generatedAt?: string;
  model?: string;
};

export async function renderDraftDocx(plan: DraftPlan, metadata: DraftMetadata, generatedDraft?: GeneratedPolicyDraft): Promise<Buffer> {
  const markdownBlocks = generatedDraft ? parseMarkdownBlocks(generatedDraft.markdown) : [];
  const titleIndex = markdownBlocks.findIndex((block) => block.type === "title");
  const title = titleIndex >= 0 ? markdownBlocks[titleIndex] : null;
  const contentBlocks = markdownBlocks.filter((_, index) => index !== titleIndex);
  const body = generatedDraft
    ? [
      title && title.type !== "table" ? renderParagraphBlock(title) : new Paragraph({ text: `${metadata.productName}隐私政策`, heading: HeadingLevel.TITLE }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [new TextRun({ text: `适用产品：${metadata.productName} ${metadata.productVersion}`, color: "59645F", size: 19 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        children: [new TextRun({ text: `生效日期：${metadata.policyEffectiveDate || "以正文为准"}　更新日期：${metadata.generatedAt || new Date().toISOString().slice(0, 10)}`, color: "59645F", size: 18 })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ text: "目录", style: "TOCHeading" }),
      new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }),
      new Paragraph({ children: [new PageBreak()] }),
      ...contentBlocks.flatMap(renderBlock),
    ]
    : [
      new Paragraph({ text: `${metadata.productName}隐私政策`, heading: HeadingLevel.TITLE }),
      new Paragraph(`本政策适用于${metadata.operatorName}提供的${metadata.productName} ${metadata.productVersion}。`),
      new Paragraph({ text: "我们如何收集和使用个人信息", heading: HeadingLevel.HEADING_1 }),
      ...plan.body.map((node) => new Paragraph({ children: [new TextRun({ text: node.text }), new TextRun({ text: `  [${node.assertionId}]`, color: "708078", size: 16 })] })),
    ];

  const document = new Document({
    title: `${metadata.productName}隐私政策`,
    subject: "个人信息处理规则",
    creator: metadata.operatorName,
    description: `适用于${metadata.productName} ${metadata.productVersion}`,
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: "宋体", size: 21, color: "222222" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 140 } },
        },
      },
      paragraphStyles: [
        {
          id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "黑体", size: 36, bold: true, color: "172B25" },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 260 } },
        },
        {
          id: "TOCHeading", name: "TOC Heading", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "黑体", size: 28, bold: true, color: "172B25" },
          paragraph: { spacing: { before: 0, after: 240 }, keepNext: true },
        },
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "黑体", size: 28, bold: true, color: "172B25" },
          paragraph: { spacing: { before: 360, after: 180 }, keepNext: true, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "黑体", size: 24, bold: true, color: "243F36" },
          paragraph: { spacing: { before: 280, after: 140 }, keepNext: true, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${metadata.productName} · 隐私政策`, color: "777777", size: 16 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "第 ", color: "777777", size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: "777777", size: 16 }), new TextRun({ text: " 页", color: "777777", size: 16 })] })] }) },
      children: body,
    }],
  });

  return Packer.toBuffer(document);
}

function renderBlock(block: MarkdownBlock): Array<Paragraph | Table> {
  return block.type === "table" ? [renderTable(block)] : [renderParagraphBlock(block)];
}

function renderParagraphBlock(block: Exclude<MarkdownBlock, { type: "table" }>) {
  const heading = block.type === "title" ? HeadingLevel.TITLE : block.type === "heading1" ? HeadingLevel.HEADING_1 : block.type === "heading2" ? HeadingLevel.HEADING_2 : undefined;
  return new Paragraph({
    children: inlineRuns(block.markdown, block.type === "quote"),
    heading,
    bullet: block.type === "bullet" ? { level: 0 } : undefined,
    alignment: block.type === "paragraph" || block.type === "numbered" ? AlignmentType.JUSTIFIED : undefined,
    indent: block.type === "quote" ? { left: 360, right: 360 } : undefined,
    shading: block.type === "quote" ? { type: ShadingType.CLEAR, fill: "F3F6F4" } : undefined,
    keepNext: heading ? true : undefined,
  });
}

function inlineRuns(markdown: string, quote = false) {
  return parseMarkdownInline(markdown).map((token) => {
    const run = new TextRun({ text: token.text, bold: token.bold, italics: token.italics || quote, color: token.link ? "0563C1" : quote ? "555555" : "222222", underline: token.link ? {} : undefined });
    return token.link ? new ExternalHyperlink({ children: [run], link: token.link }) : run;
  });
}

function renderTable(block: Extract<MarkdownBlock, { type: "table" }>) {
  const columnCount = Math.max(1, block.headers.length);
  const width = Math.floor(9_000 / columnCount);
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "AEB9B4" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "AEB9B4" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "AEB9B4" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "AEB9B4" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D7DEDA" },
    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "D7DEDA" },
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: columnCount }, () => width),
    layout: TableLayoutType.AUTOFIT,
    borders,
    rows: [
      new TableRow({ children: block.headers.map((header) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "E8F0EC" },
        children: [new Paragraph({ children: inlineRuns(`**${header}**`) })],
      })) }),
      ...block.rows.map((row) => new TableRow({ children: Array.from({ length: columnCount }, (_, index) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        children: [new Paragraph({ children: inlineRuns(row[index] ?? "") })],
      })) })),
    ],
  });
}
