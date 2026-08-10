"use client";

import type { ReactNode } from "react";
import { parseMarkdownBlocks, type MarkdownBlock } from "@/src/documents/markdown";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\[\[待确认:[^\]]+\]\])/g);
  return parts.map((part, index) => part.startsWith("[[待确认:")
    ? <mark className="draft-placeholder" key={`${part}-${index}`}>{part}</mark>
    : <span key={`${part}-${index}`}>{part}</span>);
}

function renderBlock(block: MarkdownBlock, index: number) {
  const content = renderInline(block.text);
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
