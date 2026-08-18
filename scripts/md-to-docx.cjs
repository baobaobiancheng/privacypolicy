#!/usr/bin/env node
// 轻量 Markdown -> Word(.docx) 转换器，用于本项目的中文示例/报告文档。
// 用法: node scripts/md-to-docx.cjs <input.md> <output.docx>
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType,
} = require("docx");

const inputFile = path.resolve(process.argv[2]);
const outputFile = path.resolve(process.argv[3]);
const markdown = fs.readFileSync(inputFile, "utf8");

function inlineRuns(text) {
  const runs = [];
  // 解析 **bold** 与 [text](url)，保留普通文本。
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let cursor = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > cursor) runs.push(new TextRun({ text: text.slice(cursor, m.index) }));
    if (m[1]) runs.push(new TextRun({ text: m[1], bold: true }));
    else if (m[2] && m[3]) runs.push(new TextRun({ text: m[2], color: "0563C1", underline: {} }));
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) runs.push(new TextRun({ text: text.slice(cursor) }));
  return runs.length ? runs : [new TextRun({ text: "" })];
}

function paragraph(text, options = {}) {
  return new Paragraph({ children: inlineRuns(text), ...options });
}

function parseBlocks(md) {
  const blocks = [];
  let paragraphLines = [];
  const lines = md.replace(/\r\n?/g, "\n").split("\n");

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ").trim() });
      paragraphLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^<!--/.test(line)) { flushParagraph(); continue; }

    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      const level = line.match(/^(#+)\s+/)[1].length;
      blocks.push({ type: "heading", level, text: line.replace(/^#+\s+/, "").trim() });
    } else if (/^\|.+\|$/.test(line) && /^\|.+\|$/.test(lines[i + 1]?.trim() ?? "")) {
      flushParagraph();
      const headerCells = line.slice(1, -1).split("|").map((s) => s.trim());
      const rows = [];
      i++; // skip separator
      while (i + 1 < lines.length && /^\|.+\|$/.test(lines[i + 1].trim())) {
        i++;
        rows.push(lines[i].slice(1, -1).split("|").map((s) => s.trim()));
      }
      blocks.push({ type: "table", header: headerCells, rows });
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      blocks.push({ type: "bullet", text: line.replace(/^[-*]\s+/, "").trim() });
    } else if (/^>\s?/.test(line)) {
      flushParagraph();
      blocks.push({ type: "quote", text: line.replace(/^>\s?/, "").trim() });
    } else if (/^---+\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "rule" });
    } else {
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  return blocks;
}

function tableCell(text, opts = {}) {
  return new TableCell({
    children: [paragraph(text, opts)],
    width: { size: 100 / (opts.cols || 4), type: WidthType.PERCENTAGE },
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading, color: "auto" } : undefined,
  });
}

function buildChildren(blocks) {
  const children = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6 };
        children.push(new Paragraph({ heading: map[block.level] || HeadingLevel.HEADING_3, children: inlineRuns(block.text), spacing: { before: 240, after: 120 } }));
        break;
      case "paragraph":
        children.push(paragraph(block.text, { spacing: { after: 120 } }));
        break;
      case "bullet":
        children.push(new Paragraph({ children: [new TextRun({ text: "• " }), ...inlineRuns(block.text)], bullet: { level: 0 }, spacing: { after: 80 } }));
        break;
      case "quote":
        children.push(new Paragraph({ children: inlineRuns(block.text), indent: { left: 360 }, spacing: { after: 120 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: "999999", space: 8 } } }));
        break;
      case "rule":
        children.push(new Paragraph({ children: [], spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 6 } } }));
        break;
      case "table": {
        const cols = block.header.length;
        const rows = [
          new TableRow({ tableHeader: true, children: block.header.map((h) => tableCell(h, { bold: true, shading: "DDEBF7", cols })) }),
          ...block.rows.map((row) => new TableRow({ children: row.map((cell) => tableCell(cell, { cols })) })),
        ];
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        children.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        break;
      }
    }
  }
  return children;
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Microsoft YaHei", size: 21, color: "222222" } },
    },
  },
  sections: [{ properties: {}, children: buildChildren(parseBlocks(markdown)) }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputFile, buffer);
  console.log(`OK: ${outputFile} (${buffer.length} bytes)`);
});
