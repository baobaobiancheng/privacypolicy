"use client";

import { useEffect, useRef } from "react";

import {
  CaretRight,
  CaretUp,
  Copy,
  FileDoc,
  FilePdf,
  FileText,
  FileXls,
  ImageSquare,
  Paperclip,
  PaperPlaneTilt,
  Sparkle,
  SpinnerGap,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { ASSISTANT_EXAMPLES, type AssistantAttachment, type AssistantMessage } from "./workspace-model";

type AssistantPanelProps = {
  open: boolean;
  messages: AssistantMessage[];
  attachments: AssistantAttachment[];
  attachmentsCollapsed: boolean;
  input: string;
  sending: boolean;
  error: string | null;
  hasReadingAttachment: boolean;
  readyAttachmentCount: number;
  onToggle: () => void;
  onClear: () => void;
  onSend: (prompt?: string, appendUserMessage?: boolean) => void;
  onCopy: (content: string) => void;
  onApplySuggestion: (message: AssistantMessage) => void;
  onInput: (value: string) => void;
  onFiles: (files: FileList | null) => void;
  onToggleAttachments: () => void;
  onToggleAttachmentFactUse: (id: string) => void;
  onRemoveAttachment: (id: string) => void;
};

export function AssistantPanel(props: AssistantPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [props.messages, props.sending]);

  return <aside className="workspace-ai-panel" aria-label="AI 助手">
    <div className="workspace-ai-heading">
      <span><Sparkle weight="fill" /></span>
      {props.open ? <strong>AI 助手</strong> : null}
      {props.open && props.messages.length > 0 ? <button type="button" className="workspace-ai-new" onClick={props.onClear} disabled={props.sending}>新对话</button> : null}
      <button type="button" aria-label={props.open ? "收起 AI 助手" : "展开 AI 助手"} aria-expanded={props.open} onClick={props.onToggle}><CaretRight weight="bold" /></button>
    </div>
    {props.open ? <div className="workspace-ai-body">
      {props.messages.length === 0 ? <div className="workspace-ai-empty">
        <div className="workspace-ai-empty-icon"><Sparkle weight="fill" /></div>
        <strong>我可以帮你填写当前表单</strong>
        <p>直接提问，或上传产品说明、SDK 文档和截图。我会整理为待确认内容，不会自动写入隐私政策。</p>
        <div className="workspace-ai-examples" aria-label="示例问题">
          {ASSISTANT_EXAMPLES.map((example) => <button type="button" key={example} disabled={props.sending} onClick={() => props.onSend(example)}><span>{example}</span><CaretRight weight="bold" /></button>)}
        </div>
      </div> : <div className="workspace-ai-messages" aria-live="polite">
        {props.messages.map((message) => <article key={message.id} className="workspace-ai-message" data-role={message.role}>
          {message.role === "assistant" ? <div className="workspace-ai-message-label"><span><Sparkle weight="fill" /> AI 助手</span><button type="button" aria-label="复制回答" onClick={() => props.onCopy(message.content)}><Copy weight="bold" /></button></div> : null}
          {message.role === "user" && message.attachmentNames?.length ? <div className="workspace-ai-message-files">{message.attachmentNames.map((name, index) => <span key={`${name}-${index}`}><Paperclip weight="bold" /> {name}</span>)}</div> : null}
          <p>{message.content}</p>
          {message.suggestedText ? <div className="workspace-ai-suggestion"><span>{message.suggestedText}</span><button type="button" disabled={message.applied} onClick={() => props.onApplySuggestion(message)}>{message.applied ? "已填入表单" : "填入表单"}</button></div> : null}
        </article>)}
        {props.sending ? <div className="workspace-ai-loading" role="status"><span /><span /><span /><em>AI 正在整理回答</em></div> : null}
        {props.error ? <div className="workspace-ai-chat-error" role="alert"><span>{props.error}</span><button type="button" onClick={() => props.onSend(props.messages.filter((message) => message.role === "user").at(-1)?.content ?? "", false)}>重试</button></div> : null}
        <div ref={endRef} />
      </div>}
      <div className="workspace-ai-composer">
        {props.attachments.length > 0 ? <section className="workspace-ai-attachment-tray" data-collapsed={props.attachmentsCollapsed}>
          <div className="workspace-ai-attachment-heading">
            <span>已加入资料 <b>{props.attachments.length}/5</b></span>
            <button type="button" onClick={props.onToggleAttachments}>{props.attachmentsCollapsed ? <><CaretRight weight="bold" /> 展开</> : <><CaretUp weight="bold" /> 收起</>}</button>
          </div>
          {!props.attachmentsCollapsed ? <div className="workspace-ai-attachment-list">{props.attachments.map((attachment) => <article key={attachment.id} className="workspace-ai-attachment" data-status={attachment.status}>
            <span className="workspace-ai-attachment-icon"><AttachmentIcon attachment={attachment} /></span>
            <div><strong title={attachment.name}>{attachment.name}</strong><small>{formatAttachmentSize(attachment.size)} · {attachment.status === "READING" ? "正在读取" : attachment.status === "READY" ? attachment.kind === "IMAGE" ? "已提取图片文字" : attachment.truncated ? "已读取（部分内容）" : "已读取" : attachment.error ?? "读取失败"}</small>{attachment.status === "READY" ? <button type="button" className="workspace-ai-attachment-fact-use" data-active={attachment.useForFormFilling} onClick={() => props.onToggleAttachmentFactUse(attachment.id)}>{attachment.useForFormFilling ? "本产品资料，可用于补充" : "仅供问答参考"}</button> : null}</div>
            {attachment.status === "READING" ? <SpinnerGap className="workspace-ai-attachment-spinner" weight="bold" /> : attachment.status === "READY" ? <i aria-label="已理解" /> : <WarningCircle className="workspace-ai-attachment-warning" weight="fill" />}
            <button type="button" className="workspace-ai-attachment-remove" aria-label={`删除 ${attachment.name}`} onClick={() => props.onRemoveAttachment(attachment.id)}><X weight="bold" /></button>
          </article>)}</div> : null}
        </section> : null}
        <div className="workspace-ai-input-shell">
          <textarea rows={3} value={props.input} disabled={props.sending} placeholder="输入问题，或上传文件后提问…" onChange={(event) => props.onInput(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              props.onSend();
            }
          }} />
          <input ref={fileInputRef} className="workspace-ai-file-input" type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => {
            props.onFiles(event.target.files);
            event.target.value = "";
          }} />
          <button type="button" className="workspace-ai-upload" data-analytics-id="attachment.upload" title="上传 PDF、Word、TXT、CSV 或图片；单文件 20 MB，最多 5 个" aria-label="上传文件或图片" disabled={props.sending || props.attachments.length >= 5} onClick={() => fileInputRef.current?.click()}><Paperclip weight="bold" /></button>
          <button type="button" className="workspace-ai-send" data-analytics-id="assistant.send" aria-label="发送问题" disabled={props.sending || props.hasReadingAttachment || (!props.input.trim() && props.readyAttachmentCount === 0)} onClick={() => props.onSend()}><PaperPlaneTilt weight="fill" /></button>
        </div>
      </div>
    </div> : null}
  </aside>;
}

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ attachment }: { attachment: AssistantAttachment }) {
  // Blob URLs are ephemeral local previews and cannot be optimized by next/image.
  // eslint-disable-next-line @next/next/no-img-element
  if (attachment.previewUrl) return <img src={attachment.previewUrl} alt="" />;
  if (attachment.kind === "IMAGE") return <ImageSquare weight="duotone" />;
  if (attachment.kind === "SPREADSHEET") return <FileXls weight="duotone" />;
  if (attachment.mimeType === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf")) return <FilePdf weight="duotone" />;
  if (attachment.kind === "TEXT") return <FileText weight="duotone" />;
  return <FileDoc weight="duotone" />;
}
