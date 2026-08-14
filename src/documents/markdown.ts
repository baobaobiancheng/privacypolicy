import type { MarkdownOpenItem } from "@/src/ai/deepseek";

export type InlineToken = { text: string; bold?: boolean; italics?: boolean; link?: string };
export type MarkdownBlock =
  | { type: "title" | "heading1" | "heading2" | "paragraph" | "quote" | "bullet" | "numbered"; text: string; markdown: string }
  | { type: "table"; headers: string[]; rows: string[][]; markdown: string };

/** Remove trace comments and turn the supported Markdown subset into safe blocks. */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const flush = () => {
    const markdownText = paragraph.join(" ").trim();
    const text = cleanMarkdownText(markdownText);
    if (text) blocks.push({ type: "paragraph", text, markdown: markdownText });
    paragraph = [];
  };

  const pushBlock = (type: Exclude<MarkdownBlock["type"], "table">, markdownText: string) => {
    const text = cleanMarkdownText(markdownText);
    if (text) blocks.push({ type, text, markdown: markdownText });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || /^<!--/.test(line)) {
      flush();
      continue;
    }
    const withoutComments = line.replace(/<!--.*?-->/g, "").trim();
    if (!withoutComments) {
      flush();
      continue;
    }
    if (isTableRow(withoutComments) && isTableSeparator(lines[index + 1]?.trim() ?? "")) {
      flush();
      const headers = splitTableRow(withoutComments);
      const rawRows = [withoutComments, lines[index + 1].trim()];
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index].trim())) {
        rawRows.push(lines[index].trim());
        rows.push(splitTableRow(lines[index].trim()));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "table", headers, rows, markdown: rawRows.join("\n") });
    } else if (/^###\s+/.test(withoutComments)) {
      flush();
      pushBlock("heading2", withoutComments.replace(/^###\s+/, ""));
    } else if (/^##\s+/.test(withoutComments)) {
      flush();
      pushBlock("heading1", withoutComments.replace(/^##\s+/, ""));
    } else if (/^#\s+/.test(withoutComments)) {
      flush();
      pushBlock("title", withoutComments.replace(/^#\s+/, ""));
    } else if (/^[-*]\s+/.test(withoutComments)) {
      flush();
      pushBlock("bullet", withoutComments.replace(/^[-*]\s+/, ""));
    } else if (/^\d+[.)、]\s*/.test(withoutComments)) {
      flush();
      pushBlock("numbered", withoutComments);
    } else if (/^>\s?/.test(withoutComments)) {
      flush();
      pushBlock("quote", withoutComments.replace(/^>\s?/, ""));
    } else {
      paragraph.push(withoutComments);
    }
  }
  flush();
  return blocks;
}

export function parseMarkdownInline(markdown: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  let cursor = 0;
  for (const match of markdown.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) tokens.push({ text: markdown.slice(cursor, start) });
    if (match[1] && match[2]) tokens.push({ text: match[1], link: match[2] });
    else if (match[3] || match[4]) tokens.push({ text: match[3] ?? match[4], bold: true });
    else if (match[5] || match[6]) tokens.push({ text: match[5] ?? match[6], italics: true });
    else if (match[7]) tokens.push({ text: match[7] });
    cursor = start + match[0].length;
  }
  if (cursor < markdown.length) tokens.push({ text: markdown.slice(cursor) });
  return tokens.filter((token) => token.text.length > 0);
}

export function collectMarkdownOpenItems(markdown: string): MarkdownOpenItem[] {
  return [...markdown.matchAll(/<!--\s*open-item:\s*([^|>]+?)\s*\|\s*([^>]+?)\s*-->/gi)].map((match) => ({
    assertionId: match[1].trim(),
    reason: match[2].trim(),
  }));
}

export function cleanMarkdownText(text: string): string {
  return parseMarkdownInline(text).map((token) => token.text).join("").trim();
}

function isTableRow(line: string) {
  return /^\|.+\|$/.test(line);
}

function isTableSeparator(line: string) {
  return isTableRow(line) && splitTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function splitTableRow(line: string) {
  return line.slice(1, -1).split("|").map((cell) => cell.trim());
}
