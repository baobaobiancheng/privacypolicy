"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getMobilityQuestionnaire, getQuestionnaireScenarios } from "@/src/questionnaires/mobility";
import { createBrowserId } from "@/src/browser/random-id";
import {
  CLIENT_PERSONA_ID,
  type AssistantAttachment,
  type AssistantMessage,
  type ProjectData,
} from "./workspace-model";

type AssistantField = { key: string; label: string; value: string; required: boolean; complete: boolean };
type AssistantFact = { section: string; label: string; value: string };

type WorkspaceAssistantOptions = {
  projectId: string | null;
  data: ProjectData;
  dataRef: { current: ProjectData };
  currentStep: string;
  currentStepFields: AssistantField[];
  projectFacts: AssistantFact[];
  selectedFeatures: Array<{ name: string; purpose: string }>;
  processedInformation: string[];
  commit: (next: Partial<ProjectData>, message?: string) => void;
  setStatusMessage: Dispatch<SetStateAction<string>>;
};

export function useWorkspaceAssistant(options: WorkspaceAssistantOptions) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [attachmentsCollapsed, setAttachmentsCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const loadedKeyRef = useRef<string | null>(null);
  const storageKey = `privacy-policy-assistant:v3:${options.projectId ?? "new"}`;
  const readyAttachments = attachments.filter((attachment) => attachment.status === "READY" && attachment.content);
  const hasReadingAttachment = attachments.some((attachment) => attachment.status === "READING");

  useEffect(() => {
    if (loadedKeyRef.current === storageKey) return;
    loadedKeyRef.current = storageKey;
    setStorageReady(false);
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) {
        setMessages([]);
        setAttachments([]);
        setStorageReady(true);
        return;
      }
      const parsed = JSON.parse(stored) as { messages?: unknown; attachments?: unknown };
      const restoredMessages = (Array.isArray(parsed.messages) ? parsed.messages : []).filter((item): item is AssistantMessage => Boolean(
        item && typeof item === "object"
        && typeof (item as AssistantMessage).id === "string"
        && ((item as AssistantMessage).role === "user" || (item as AssistantMessage).role === "assistant")
        && typeof (item as AssistantMessage).content === "string",
      )).slice(-20);
      const restoredAttachments = (Array.isArray(parsed.attachments) ? parsed.attachments : []).filter((item): item is AssistantAttachment => Boolean(
        item && typeof item === "object"
        && typeof (item as AssistantAttachment).id === "string"
        && typeof (item as AssistantAttachment).name === "string"
        && typeof (item as AssistantAttachment).content === "string"
        && (item as AssistantAttachment).status === "READY",
      )).slice(0, 5).map((attachment) => ({ ...attachment, useForFormFilling: attachment.useForFormFilling === true }));
      setMessages(restoredMessages);
      setAttachments(restoredAttachments);
    } catch {
      setMessages([]);
      setAttachments([]);
    } finally {
      setStorageReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady || loadedKeyRef.current !== storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({
        messages: messages.slice(-20),
        attachments: attachments.filter((attachment) => attachment.status === "READY").map(serializableAttachment),
      }));
    } catch {
      // A full/private sessionStorage must not interrupt form filling.
    }
  }, [attachments, messages, storageKey, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    const persisted = options.data.attachments.filter((attachment) => attachment.status === "CONFIRMED" && attachment.content.trim());
    if (!persisted.length) return;
    setAttachments((current) => {
      const existing = new Set(current.map((attachment) => attachment.id));
      const missing: AssistantAttachment[] = persisted.filter((attachment) => !existing.has(attachment.id)).map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
        kind: attachment.kind,
        status: "READY",
        content: attachment.content,
        truncated: attachment.truncated,
        useForFormFilling: true,
      }));
      return missing.length ? [...current, ...missing].slice(0, 5) : current;
    });
  }, [options.data.attachments, storageReady]);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = Math.max(0, 5 - attachments.length);
    if (!remaining) {
      options.setStatusMessage("每次最多上传 5 个文件，请先删除不需要的附件");
      return;
    }
    const accepted = Array.from(files).slice(0, remaining);
    if (files.length > remaining) options.setStatusMessage(`已加入前 ${remaining} 个文件，单次最多 5 个`);
    const staged = accepted.map((file) => {
      const id = messageId("attachment");
      const item: AssistantAttachment = {
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        kind: attachmentKind(file),
        status: "READING",
        useForFormFilling: false,
        ...(file.type.startsWith("image/") ? { previewUrl: URL.createObjectURL(file) } : {}),
      };
      return { file, item };
    });
    setAttachments((current) => [...current, ...staged.map(({ item }) => item)]);
    setAttachmentsCollapsed(false);
    for (const { file, item } of staged) void readAttachment(item.id, file);
  }

  async function readAttachment(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/assistant/attachments", { method: "POST", headers: { "x-persona-id": CLIENT_PERSONA_ID }, body });
      const payload = await response.json().catch(() => null) as {
        name?: string; mimeType?: string; size?: number; kind?: AssistantAttachment["kind"];
        text?: string; truncated?: boolean; message?: string;
      } | null;
      if (!response.ok || !payload?.text || !payload.kind) throw new Error(payload?.message || "文件读取失败。");
      setAttachments((current) => {
        const otherLength = current.filter((item) => item.id !== id && item.status === "READY").reduce((sum, item) => sum + (item.content?.length ?? 0), 0);
        if (otherLength + payload.text!.length > 60_000) {
          return current.map((item) => item.id === id ? { ...item, status: "FAILED", error: "附件可读内容总量已达上限，请先删除其他文件。", content: undefined } : item);
        }
        return current.map((item) => item.id === id ? {
          ...item,
          name: payload.name ?? item.name,
          mimeType: payload.mimeType ?? item.mimeType,
          size: payload.size ?? item.size,
          kind: payload.kind!,
          status: "READY",
          content: payload.text,
          truncated: payload.truncated,
          error: undefined,
        } : item);
      });
    } catch (attachmentError) {
      setAttachments((current) => current.map((item) => item.id === id ? {
        ...item,
        status: "FAILED",
        error: attachmentError instanceof Error ? attachmentError.message : "文件读取失败。",
      } : item));
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
    options.commit({ attachments: options.dataRef.current.attachments.filter((attachment) => attachment.id !== id) }, "资料已移除");
  }

  function toggleAttachmentFactUse(id: string) {
    const next = attachments.map((attachment) => attachment.id === id ? { ...attachment, useForFormFilling: !attachment.useForFormFilling } : attachment);
    setAttachments(next);
    options.commit({ attachments: next.filter((attachment) => attachment.status === "READY").map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      status: attachment.useForFormFilling ? "CONFIRMED" as const : "PENDING" as const,
      mimeType: attachment.mimeType,
      size: attachment.size,
      content: attachment.useForFormFilling ? (attachment.content ?? "") : "",
      truncated: attachment.truncated ?? false,
    })) }, "附件用途已保存；只有标记为本产品资料的内容可用于补充建议");
  }

  async function send(prompt = input, appendUserMessage = true) {
    const content = prompt.trim() || (readyAttachments.length ? "请阅读已上传资料，说明其中与当前项目隐私政策相关的要点，并指出可能需要补充的表单信息。" : "");
    if (!content || sending || hasReadingAttachment) return;
    const userMessage: AssistantMessage = { id: messageId("user"), role: "user", content, attachmentNames: readyAttachments.map((attachment) => attachment.name) };
    const conversation = (appendUserMessage ? [...messages, userMessage] : messages).slice(-20);
    if (appendUserMessage) setMessages(conversation);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
        body: JSON.stringify({
          messages: conversation.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          projectContext: {
            currentStep: options.currentStep,
            productName: options.data.profile.productName ?? "",
            operatorName: options.data.profile.operatorName ?? "",
            selectedFeatures: options.selectedFeatures,
            processedInformation: options.processedInformation,
            additionalNotes: options.data.additionalNotes,
            currentStepFields: options.currentStepFields,
            projectFacts: options.projectFacts,
          },
          attachments: readyAttachments.map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            kind: attachment.kind,
            content: attachment.content!,
            truncated: attachment.truncated ?? false,
            useForFormFilling: attachment.useForFormFilling,
          })),
        }),
      });
      const payload = await response.json().catch(() => null) as { answer?: string; suggestedText?: string; suggestionTarget?: AssistantMessage["suggestionTarget"]; message?: string } | null;
      if (!response.ok || !payload?.answer) throw new Error(payload?.message || "AI 助手暂时无法回答，请稍后重试。");
      const assistantMessage: AssistantMessage = {
        id: messageId("assistant"),
        role: "assistant",
        content: payload.answer!,
        suggestedText: payload.suggestedText,
        suggestionTarget: payload.suggestionTarget,
      };
      setMessages((current) => [...current, assistantMessage].slice(-20));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 助手暂时无法回答，请稍后重试。");
    } finally {
      setSending(false);
    }
  }

  function applySuggestion(message: AssistantMessage) {
    if (!message.suggestedText || message.applied) return;
    const target = message.suggestionTarget;
    const scenarios = getQuestionnaireScenarios(options.dataRef.current.categoryKey);
    const questionnaire = getMobilityQuestionnaire(options.dataRef.current.categoryKey);
    const basicFeatureIds = new Set(questionnaire.features.filter((item) => item.kind === "BASIC").map((item) => item.key));
    const scenario = target?.featureName ? scenarios.find((item) => item.title === target.featureName) : undefined;
    const customFeature = target?.featureName && options.dataRef.current.customFeatures.includes(target.featureName) ? target.featureName : undefined;
    if (target?.kind === "FEATURE_INFORMATION" && (scenario || customFeature)) {
      const featureKey = scenario?.id ?? `custom:${customFeature!}`;
      const current = options.dataRef.current.processingActivities.find((item) => item.featureKey === featureKey)
        ?? { featureKey, title: target.featureName!, kind: scenario ? (basicFeatureIds.has(scenario.id) ? "BASIC" as const : "EXTENSION" as const) : "CUSTOM" as const, informationItems: [], informationOther: [], purposes: [], purposeOther: "" };
      options.commit({ processingActivities: [...options.dataRef.current.processingActivities.filter((item) => item.featureKey !== featureKey), { ...current, informationOther: [...new Set([...current.informationOther, message.suggestedText.trim()])] }] }, `已填入“${target.featureName}”的其他个人信息，请核对`);
    } else if (target?.kind === "FEATURE_PURPOSE" && scenario) {
      const current = options.dataRef.current.activityDetails[scenario.id] ?? { purpose: "" };
      options.commit({ activityDetails: { ...options.dataRef.current.activityDetails, [scenario.id]: { ...current, purpose: [...new Set([...current.purpose.split("；").filter(Boolean), message.suggestedText.trim()])].join("；") } } }, `已填入“${target.featureName}”的处理目的，请核对`);
    } else if (target?.kind === "FEATURE_PURPOSE" && customFeature) {
      const current = options.dataRef.current.customDetails[customFeature] ?? { purpose: "" };
      options.commit({ customDetails: { ...options.dataRef.current.customDetails, [customFeature]: { ...current, purpose: [...new Set([...current.purpose.split("；").filter(Boolean), message.suggestedText.trim()])].join("；") } } }, `已填入“${target.featureName}”的处理目的，请核对`);
    } else {
      options.commit({ additionalNotes: [options.dataRef.current.additionalNotes.trim(), message.suggestedText.trim()].filter(Boolean).join("\n\n") }, "内容已加入其他补充信息，请核对");
    }
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, applied: true } : item));
  }

  async function copy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      options.setStatusMessage("回答已复制");
    } catch {
      options.setStatusMessage("复制失败，请手动选择文本");
    }
  }

  function persistSessionForProject(projectId: string) {
    try {
      window.sessionStorage.setItem(`privacy-policy-assistant:v3:${projectId}`, JSON.stringify({
        messages: messages.slice(-20),
        attachments: attachments.filter((attachment) => attachment.status === "READY").map(serializableAttachment),
      }));
      window.sessionStorage.removeItem("privacy-policy-assistant:v3:new");
    } catch {
      // Session transfer is best-effort; confirmed facts are persisted separately.
    }
  }

  return {
    open,
    messages,
    attachments,
    attachmentsCollapsed,
    input,
    sending,
    error,
    readyAttachments,
    hasReadingAttachment,
    setInput,
    toggleOpen: () => setOpen((value) => !value),
    clear: () => { if (!sending) { setMessages([]); setInput(""); setError(null); } },
    send,
    copy,
    applySuggestion,
    addFiles,
    toggleAttachments: () => setAttachmentsCollapsed((value) => !value),
    toggleAttachmentFactUse,
    removeAttachment,
    persistSessionForProject,
  };
}

function attachmentKind(file: File): AssistantAttachment["kind"] {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)) return "IMAGE";
  if (extension === "csv") return "SPREADSHEET";
  if (file.type.startsWith("text/") || ["txt", "md", "markdown", "json"].includes(extension)) return "TEXT";
  return "DOCUMENT";
}

function messageId(prefix: string) {
  return `${prefix}-${createBrowserId()}`;
}

function serializableAttachment(attachment: AssistantAttachment): Omit<AssistantAttachment, "previewUrl"> {
  return {
    id: attachment.id,
    name: attachment.name,
    size: attachment.size,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    status: attachment.status,
    content: attachment.content,
    truncated: attachment.truncated,
    error: attachment.error,
    useForFormFilling: attachment.useForFormFilling,
  };
}
