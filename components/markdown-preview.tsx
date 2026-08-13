"use client";

import type { ReactNode } from "react";
import { parseMarkdownBlocks, type MarkdownBlock } from "@/src/documents/markdown";

function renderInline(text: string): ReactNode[] {
  const tokenPattern = /(\[\[待确认:[^\]]+\]\]|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  const parts = text.split(tokenPattern).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("[[待确认:")) return <mark className="draft-placeholder" key={`${part}-${index}`}>{part}</mark>;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a href={link[2]} target="_blank" rel="noreferrer" key={`${part}-${index}`}>{link[1]}</a>;
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderBlock(block: MarkdownBlock, index: number) {
  const content = renderInline(block.markdown);
  if (block.type === "title") return <h3 key={index}>{content}</h3>;
  if (block.type === "heading1") return <h4 key={index}>{content}</h4>;
  if (block.type === "heading2") return <h5 key={index}>{content}</h5>;
  if (block.type === "bullet") return <p className="draft-bullet" key={index}>• {content}</p>;
  if (block.type === "quote") return <blockquote key={index}>{content}</blockquote>;
  return <p key={index}>{content}</p>;
}

export function MarkdownPreview({ markdown, fallback }: { markdown?: string; fallback: ReactNode }) {
  if (!markdown) return <>{fallback}</>;
  return <div className="markdown-preview">{parseMarkdownBlocks(markdown).map(renderBlock)}</div>;
}
