"use client";

import { useState } from "react";
import { CheckCircle, DownloadSimple, Eye } from "@phosphor-icons/react";
import { MarkdownPreview } from "@/components/markdown-preview";
import type { SnapshotItem } from "./workspace-model";

type Props = { history: SnapshotItem[] | null; onDownload: (item: SnapshotItem) => void };

export function GenerationHistory({ history, onDownload }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (history === null) return <p className="history-empty">正在加载生成记录…</p>;
  if (history.length === 0) return <p className="history-empty">还没有生成记录。完成确认后即可生成第一份隐私政策。</p>;

  return <div className="generation-records">{history.map((item) => {
    const expanded = expandedId === item.id;
    return <article key={item.id} className="generation-record" data-state="success">
      <div className="generation-record-status" aria-hidden="true"><CheckCircle weight="fill" /></div>
      <div className="generation-record-content">
        <div className="generation-record-heading">
          <div><strong>隐私政策已生成</strong><span>{new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</span></div>
          <p>隐私政策已生成，可在线预览或下载 Word。</p>
        </div>
        <div className="generation-record-actions">
          <button type="button" className="history-action" aria-expanded={expanded} onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}><Eye weight="bold" /> 预览 Markdown</button>
          <button type="button" className="history-action history-action-primary" onClick={() => onDownload(item)}><DownloadSimple weight="bold" /> 下载 Word</button>
        </div>
        {expanded && item.markdown ? <div className="generation-record-detail markdown-detail"><MarkdownPreview markdown={item.markdown} fallback={null} /></div> : null}
      </div>
    </article>;
  })}</div>;
}
