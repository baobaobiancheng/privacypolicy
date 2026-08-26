"use client";

import { useState } from "react";
import { DownloadSimple, Eye, FileDoc } from "@phosphor-icons/react";
import { MarkdownPreview } from "@/components/markdown-preview";
import type { SnapshotItem } from "./workspace-model";

type Props = { history: SnapshotItem[] | null; onDownload: (item: SnapshotItem) => void };

export function GenerationHistory({ history, onDownload }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (history === null) return <p className="history-empty">正在加载生成记录…</p>;
  if (history.length === 0) return <p className="history-empty">还没有生成记录。完成确认后即可生成第一份隐私政策。</p>;

  return <div className="generation-records">{history.map((item) => {
    const expanded = expandedId === item.id;
    return <article key={item.id} className="generation-record">
      <div className="generation-record-toolbar">
        <div className="generation-record-summary">
          <span className="generation-record-icon" aria-hidden="true"><FileDoc weight="duotone" /></span>
          <div><strong>隐私政策已生成</strong><span>生成于 {new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</span></div>
        </div>
        <div className="generation-record-actions">
          <button type="button" className="history-action" data-analytics-id="report.preview" aria-expanded={expanded} onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}><Eye weight="bold" /> 预览 Markdown</button>
          <button type="button" className="history-action history-action-primary" data-analytics-id="report.download" onClick={() => onDownload(item)}><DownloadSimple weight="bold" /> 下载 Word</button>
        </div>
      </div>
      {expanded && item.markdown ? <div className="generation-record-detail markdown-detail"><MarkdownPreview markdown={item.markdown} fallback={null} /></div> : null}
    </article>;
  })}</div>;
}
