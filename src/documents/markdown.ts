import type { MarkdownOpenItem } from "@/src/ai/deepseek";

export type MarkdownBlock =
  | { type: "title" | "heading1" | "heading2" | "paragraph" | "quote" | "bullet"; text: string; markdown: string };

/** Remove trace comments and turn the small Markdown subset into safe blocks. */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const markdownText = paragraph.join(" ").trim();
    const text = cleanMarkdownText(markdownText);
    if (text) blocks.push({ type: "paragraph", text, markdown: markdownText });
    paragraph = [];
  };

  const pushBlock = (type: MarkdownBlock["type"], markdownText: string) => {
    const text = cleanMarkdownText(markdownText);
    if (text) blocks.push({ type, text, markdown: markdownText });
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || /^<!--/.test(line)) {
      flush();
      continue;
    }
    const withoutComments = line.replace(/<!--.*?-->/g, "").trim();
    if (!withoutComments) {
      flush();
      continue;
    }
    if (/^###\s+/.test(withoutComments)) {
      flush();
      pushBlock("heading2", withoutComments.replace(/^###\s+/, ""));
    } else if (/^##\s+/.test(withoutComments)) {
      flush();
      pushBlock("heading1", withoutComments.replace(/^##\s+/, ""));
    } else if (/^#\s+/.test(withoutComments)) {
      flush();
      pushBlock("title", withoutComments.replace(/^#\s+/, ""));
    } else if (/^(?:[-*]|\d+\.)\s+/.test(withoutComments)) {
      flush();
      pushBlock("bullet", withoutComments.replace(/^(?:[-*]|\d+\.)\s+/, ""));
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

export function collectMarkdownOpenItems(markdown: string): MarkdownOpenItem[] {
  return [...markdown.matchAll(/<!--\s*open-item:\s*([^|>]+?)\s*\|\s*([^>]+?)\s*-->/gi)].map((match) => ({
    assertionId: match[1].trim(),
    reason: match[2].trim(),
  }));
}

export function cleanMarkdownText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
