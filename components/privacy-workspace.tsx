"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BracketsCurly,
  Check,
  CheckCircle,
  CaretUp,
  CaretRight,
  FileDoc,
  FilePdf,
  FileText,
  FileXls,
  Copy,
  ImageSquare,
  Paperclip,
  PaperPlaneTilt,
  Plus,
  Sparkle,
  SpinnerGap,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { mapV1Content } from "@/src/content/map-v1";
import { scenarios } from "@/src/content/map-v1/ui-content";
import { BaijianBrand } from "@/components/baijian-brand";
import { getRequiredSupplementQuestions, getSlotScenario } from "@/src/knowledge/map-cn";
import { evaluateFormalPolicyReadiness, resolveFieldAnswer } from "@/src/knowledge/readiness";
import type { SupplementAnswer } from "@/src/knowledge/map-cn/schema";
import type { FormPayload, PreflightIssue } from "@/src/ai/deepseek";
import { FORM_SCHEMA_VERSION, ProjectFormDataSchema, WORKSPACE_STEPS, workspaceSlugFor, type ProjectFormData } from "@/src/workspace/contract";
import { canonicalizeProjectFormData, toWorkspaceCompatibilityState } from "@/src/workspace/form-adapter";
import {
  createDevelopmentProjectDefaults,
  developmentFormDefaultsEnabled,
} from "@/src/workspace/development-defaults";
import { BasicInformationStep } from "@/components/workspace/steps/basic-information-step";
import {
  ASSISTANT_EXAMPLES,
  BASIC_FEATURE_IDS,
  CLIENT_PERSONA_ID,
  INITIAL_GENERATION_STAGES,
  PERMISSION_PRESETS,
  PRESET_ADDITIONAL_FEATURES,
  PURPOSE_PRESETS,
  QUESTION_DETAIL_PRESETS,
  SECURITY_PRESETS,
  SLOT_PRESETS,
  basicProfileFields,
  profileFields,
  rightsProfileFields,
  type AssistantAttachment,
  type AssistantMessage,
  type ActivityDetail,
  type DisplayPreflightIssue,
  type GenerationJobPayload,
  type GenerationStageItem,
  type LiveGenerationState,
  type ProjectData,
  type SnapshotItem,
  type StepIndex,
} from "@/components/workspace/workspace-model";

const steps = WORKSPACE_STEPS.map((item) => item.label);

const stepLoading = () => <section className="workspace-panel panel-enter" aria-busy="true">正在加载当前步骤…</section>;
const ProcessingActivitiesStep = dynamic(
  () => import("@/components/workspace/steps/processing-activities-step").then((module) => module.ProcessingActivitiesStep),
  { loading: stepLoading },
);
const DevicePermissionsStep = dynamic(
  () => import("@/components/workspace/steps/device-permissions-step").then((module) => module.DevicePermissionsStep),
  { loading: stepLoading },
);
const PartnersStep = dynamic(
  () => import("@/components/workspace/steps/partners-step").then((module) => module.PartnersStep),
  { loading: stepLoading },
);
const StorageSecurityStep = dynamic(
  () => import("@/components/workspace/steps/storage-security-step").then((module) => module.StorageSecurityStep),
  { loading: stepLoading },
);
const RightsGenerationStep = dynamic(
  () => import("@/components/workspace/steps/rights-generation-step").then((module) => module.RightsGenerationStep),
  { loading: stepLoading },
);

type PrivacyWorkspaceProps = {
  projectId?: string;
  initialStep?: StepIndex;
};

const emptyProject: ProjectData = {
  projectId: null,
  revision: 0,
  profile: {},
  selected: [],
  customFeatures: [],
  customDetails: {},
  additionalNotes: "",
  confirmedFields: [],
  fieldAnswers: {},
  activityDetails: {},
  supplementAnswers: {},
  generatedMarkdown: "",
  processingActivities: [],
  permissions: [],
  partners: [],
  storageAndSecurity: {
    locations: ["CN"],
    retentionPolicies: ["MINIMUM_NECESSARY", "LEGAL_REQUIREMENT"],
    expiryActions: ["DELETE", "ANONYMIZE"],
    securityMeasures: [],
  },
  rightsAndGovernance: {},
  attachments: [],
};

const developmentPrefillEnabled = developmentFormDefaultsEnabled();

const initialProject: ProjectData = developmentPrefillEnabled
  ? { ...emptyProject, ...createDevelopmentProjectDefaults() }
  : emptyProject;

function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assistantFactValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(assistantFactValue).filter(Boolean).join("、");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = assistantFactValue(item);
        return text ? `${key}：${text}` : "";
      })
      .filter(Boolean)
      .join("；");
  }
  return value === undefined || value === null ? "" : String(value);
}

function AssistantAttachmentIcon({ attachment }: { attachment: AssistantAttachment }) {
  if (attachment.previewUrl) return <img src={attachment.previewUrl} alt="" />;
  if (attachment.kind === "IMAGE") return <ImageSquare weight="duotone" />;
  if (attachment.kind === "SPREADSHEET") return <FileXls weight="duotone" />;
  if (attachment.mimeType === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf")) return <FilePdf weight="duotone" />;
  if (attachment.kind === "TEXT") return <FileText weight="duotone" />;
  return <FileDoc weight="duotone" />;
}

function projectStorageKey(projectId?: string) {
  if (projectId) return `privacy-policy-project:${projectId}`;
  return developmentPrefillEnabled ? "privacy-policy-project:new:dev-prefill-v4" : "privacy-policy-project:new";
}

/** 根据表单完成度返回“最先不完整”的步骤；全部完成返回 5。 */
function firstIncompleteFor(project: ProjectData): StepIndex {
  const basicComplete = basicProfileFields.every(([key]) => Boolean(project.profile[key]?.trim()));
  if (!basicComplete) return 0;
  const selectedScenarios = scenarios.filter((scenario) => project.selected.includes(scenario.id));
  const detailsComplete = selectedScenarios.every((scenario) => {
    const detail = project.activityDetails[scenario.id];
    return Boolean(detail?.purpose?.trim());
  }) && project.customFeatures.every((feature) => Boolean(project.customDetails[feature]?.purpose?.trim()));
  const hasBasicFeature = project.selected.some((feature) => BASIC_FEATURE_IDS.has(feature))
    || project.processingActivities.some((activity) => activity.kind === "BASIC");
  if (!hasBasicFeature || !detailsComplete) return 1;
  const hasProcessedField = selectedScenarios.some((scenario) => {
    const feature = mapV1Content.payload.features.find((item) => item.key === scenario.id);
    return (feature?.fields ?? []).some((field, index) => resolveFieldAnswer(project, `${scenario.id}.${field.key}`) === "PROCESS" || resolveFieldAnswer(project, `${scenario.id}.${index}`) === "PROCESS");
  });
  const hasCustomInformation = project.processingActivities.some((activity) => activity.informationItems.length > 0);
  if (!hasProcessedField && !hasCustomInformation) return 1;
  if (!project.supplementAnswers["device-permissions"]) return 2;
  if (!project.supplementAnswers["third-party-services"]) return 3;
  if (!project.supplementAnswers["storage-locations"] || !project.profile.securityMeasures?.trim()) return 4;
  return 5;
}

const failureMessages: Record<string, { title: string; detail: string }> = {
  MODEL_OUTPUT_INVALID: {
    title: "本次草稿不完整",
    detail: "生成结果缺少必要章节，或包含表单中未确认的内容，因此没有保存为可下载文件。本次填写内容已保存，可直接重新生成。",
  },
  MODEL_REQUEST_FAILED: {
    title: "生成服务暂时繁忙",
    detail: "本次等待超时或服务暂时无法连接。填写内容已保存，请稍后直接重新生成。",
  },
  DOCX_GENERATION_FAILED: {
    title: "文件制作未完成",
    detail: "草稿转换为 Word 文件时发生异常。请重新生成；如果问题持续出现，请联系系统管理员。",
  },
  LAW_SEARCH_FAILED: {
    title: "法规资料查询未完成",
    detail: "生成前未能取得法规关键词查询结果，因此没有继续生成。填写内容已保存，可稍后重新生成。",
  },
};

export function PrivacyWorkspace({ projectId, initialStep = 0 }: PrivacyWorkspaceProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<StepIndex>(initialStep);
  const [data, setData] = useState<ProjectData>(() => ({ ...initialProject, projectId: projectId ?? null }));
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState(developmentPrefillEnabled
    ? "已载入开发测试数据，所有字段仍可修改"
    : "所有操作会保留在当前项目表单中");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [history, setHistory] = useState<SnapshotItem[] | null>(null);
  const [extractingQuestionId, setExtractingQuestionId] = useState<string | null>(null);
  const [preflightIssues, setPreflightIssues] = useState<DisplayPreflightIssue[]>([]);
  const [acknowledgedPreflightIssues, setAcknowledgedPreflightIssues] = useState<string[]>([]);
  const [explainerOpen, setExplainerOpen] = useState(true);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantAttachments, setAssistantAttachments] = useState<AssistantAttachment[]>([]);
  const [attachmentsCollapsed, setAttachmentsCollapsed] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantSending, setAssistantSending] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantStorageReady, setAssistantStorageReady] = useState(false);
  const [liveGeneration, setLiveGeneration] = useState<LiveGenerationState | null>(null);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const assistantEndRef = useRef<HTMLDivElement>(null);
  const assistantFileInputRef = useRef<HTMLInputElement>(null);
  const assistantLoadedKeyRef = useRef<string | null>(null);
  const lastSavedKeyRef = useRef<string | null>(null);
  const lastSavedStepRef = useRef<string | null>(null);
  const dataRef = useRef<ProjectData>(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (data.generated?.status !== "GENERATING" || !liveGeneration) return;
    const updateElapsed = () => setGenerationElapsed(Date.now() - liveGeneration.startedAt);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [data.generated?.status, liveGeneration?.startedAt]);

  function computeFormKey(project: Partial<ProjectData>) {
    return JSON.stringify(toProjectFormData({ ...emptyProject, ...project } as ProjectData));
  }
  const formKey = computeFormKey(data);

  async function loadProjectFromServer(id: string): Promise<{ formData: Partial<ProjectData>; revision: number; currentStepKey: string } | null> {
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { headers: { "x-persona-id": CLIENT_PERSONA_ID } });
      if (!res.ok) return null;
      const payload = await res.json() as { data: { formData: unknown; revision: number; currentStepKey: string } };
      const canonical = canonicalizeProjectFormData(payload.data.formData);
      return { formData: toWorkspaceCompatibilityState(canonical), revision: payload.data.revision, currentStepKey: payload.data.currentStepKey };
    } catch {
      return null;
    }
  }

  /** 去掉运行期本地细节，仅保留可作为表单事实入库的字段。 */
  function toProjectFormData(current: ProjectData): ProjectFormData {
    const processingActivities = [
      ...scenarios.filter((scenario) => current.selected.includes(scenario.id)).map((scenario) => ({
        featureKey: scenario.id,
        title: scenario.title,
        kind: (BASIC_FEATURE_IDS.has(scenario.id) ? "BASIC" : "EXTENSION") as "BASIC" | "EXTENSION",
        informationItems: (mapV1Content.payload.features.find((item) => item.key === scenario.id)?.fields ?? [])
          .filter((field) => resolveFieldAnswer(current, `${scenario.id}.${field.key}`) === "PROCESS")
          .map((field) => field.label),
        informationOther: current.processingActivities.find((item) => item.featureKey === scenario.id)?.informationOther ?? [],
        purposes: current.activityDetails[scenario.id]?.purpose ? [current.activityDetails[scenario.id].purpose] : [],
        purposeOther: "",
      })),
      ...current.customFeatures.map((feature) => {
        const existing = current.processingActivities.find((item) => item.featureKey === `custom:${feature}`);
        return {
          ...(existing ?? {
            featureKey: `custom:${feature}`,
            title: feature,
            kind: "CUSTOM" as const,
            informationItems: [],
            informationOther: [],
          }),
          purposes: current.customDetails[feature]?.purpose ? [current.customDetails[feature].purpose] : [],
          purposeOther: "",
        };
      }),
    ];
    const rightsAndGovernance = {
      ...current.rightsAndGovernance,
      rightsEntry: current.profile.rightsEntry ?? "",
      responsePeriod: current.profile.rightsResponsePeriod ?? "",
      contactEmail: current.profile.contactEmail ?? "",
      contactPhone: current.profile.contactPhone ?? "",
      policyEntry: current.profile.policyEntry ?? "",
      updateNotices: current.profile.policyUpdateNotice ? [current.profile.policyUpdateNotice] : [],
      minorMode: current.profile.minorProcessing?.includes("不面向") ? "ADULT_ONLY" as const : current.rightsAndGovernance.minorMode,
    };
    return ProjectFormDataSchema.parse({
      schemaVersion: FORM_SCHEMA_VERSION,
      profile: current.profile,
      additionalNotes: current.additionalNotes,
      supplementAnswers: current.supplementAnswers,
      processingActivities,
      permissions: current.permissions,
      partners: current.partners,
      storageAndSecurity: current.storageAndSecurity,
      rightsAndGovernance,
      attachments: current.attachments,
    });
  }

  /**
   * 立即把当前表单写入服务器并返回最新 revision。
   * 供所有“保存并离开”的 handler 在导航前调用，避免 400ms 防抖定时器
   * 被页面卸载清掉后丢失最后一段修改。
   */
  async function persistNow(currentStepKey = workspaceSlugFor(activeStep)): Promise<{ ok: true; revision: number } | { ok: false }> {
    const id = dataRef.current.projectId;
    if (!id) return { ok: false };
    const pending = toProjectFormData(dataRef.current);
    const key = JSON.stringify(pending);
    if (lastSavedKeyRef.current === key && lastSavedStepRef.current === currentStepKey) {
      return { ok: true, revision: dataRef.current.revision };
    }
    try {
      const res = await fetch(`/api/v1/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
        body: JSON.stringify({ expectedRevision: dataRef.current.revision, formData: pending, currentStepKey }),
      });
      if (res.status === 409) {
        setStatusMessage("项目已在其他页面更新，已重新载入最新版本");
        const server = await loadProjectFromServer(id);
        if (server) {
          lastSavedKeyRef.current = computeFormKey(server.formData);
          lastSavedStepRef.current = server.currentStepKey;
          const reloaded = { ...emptyProject, ...server.formData, projectId: id, revision: server.revision, generated: undefined };
          dataRef.current = reloaded;
          setData(reloaded);
        }
        return { ok: false };
      }
      if (!res.ok) throw new Error("保存失败");
      const payload = await res.json() as { data: { revision: number } };
      lastSavedKeyRef.current = key;
      lastSavedStepRef.current = currentStepKey;
      const mergedSave = { ...dataRef.current, revision: payload.data.revision };
      dataRef.current = mergedSave;
      setData(mergedSave);
      setSaveState("saved");
      return { ok: true, revision: payload.data.revision };
    } catch {
      setSaveState("error");
      setStatusMessage("保存到服务器失败，请检查 MySQL 是否可用");
      return { ok: false };
    }
  }

  function downloadSnapshotDocx(item: SnapshotItem) {
    window.location.assign(item.downloadUrl);
  }

  const storageKey = projectStorageKey(projectId ?? data.projectId ?? undefined);
  const assistantStorageKey = `privacy-policy-assistant:v3:${projectId ?? data.projectId ?? "new"}`;

  useEffect(() => {
    if (assistantLoadedKeyRef.current === assistantStorageKey) return;
    assistantLoadedKeyRef.current = assistantStorageKey;
    setAssistantStorageReady(false);
    try {
      const stored = window.sessionStorage.getItem(assistantStorageKey);
      if (!stored) {
        setAssistantMessages([]);
        setAssistantAttachments([]);
        setAssistantStorageReady(true);
        return;
      }
      const parsed = JSON.parse(stored) as { messages?: unknown; attachments?: unknown };
      const messageItems = Array.isArray(parsed.messages) ? parsed.messages : [];
      const messages = messageItems.filter((item): item is AssistantMessage => Boolean(
        item && typeof item === "object"
        && typeof (item as AssistantMessage).id === "string"
        && ((item as AssistantMessage).role === "user" || (item as AssistantMessage).role === "assistant")
        && typeof (item as AssistantMessage).content === "string",
      )).slice(-20);
      const attachmentItems = Array.isArray(parsed.attachments) ? parsed.attachments : [];
      const attachments = attachmentItems.filter((item): item is AssistantAttachment => Boolean(
        item && typeof item === "object"
        && typeof (item as AssistantAttachment).id === "string"
        && typeof (item as AssistantAttachment).name === "string"
        && typeof (item as AssistantAttachment).content === "string"
        && (item as AssistantAttachment).status === "READY",
      )).slice(0, 5).map((attachment) => ({ ...attachment, useForFormFilling: attachment.useForFormFilling === true }));
      setAssistantMessages(messages);
      setAssistantAttachments(attachments);
    } catch {
      setAssistantMessages([]);
      setAssistantAttachments([]);
    } finally {
      setAssistantStorageReady(true);
    }
  }, [assistantStorageKey]);

  useEffect(() => {
    if (!assistantStorageReady || assistantLoadedKeyRef.current !== assistantStorageKey) return;
    try {
      window.sessionStorage.setItem(assistantStorageKey, JSON.stringify({
        messages: assistantMessages.slice(-20),
        attachments: assistantAttachments.filter((attachment) => attachment.status === "READY").map(({ previewUrl: _previewUrl, ...attachment }) => attachment),
      }));
    } catch {
      // 会话仍可继续，仅不能跨页恢复。
    }
  }, [assistantMessages, assistantAttachments, assistantStorageKey, assistantStorageReady]);

  // 已由用户确认为“本产品资料”的附件提取文本随项目保存到 MySQL。
  // 浏览器会话丢失或换设备后，从项目事实恢复；仅供临时问答的附件不持久化正文。
  useEffect(() => {
    if (!assistantStorageReady) return;
    const persisted = data.attachments.filter((attachment) => attachment.status === "CONFIRMED" && attachment.content.trim());
    if (persisted.length === 0) return;
    setAssistantAttachments((current) => {
      const existing = new Set(current.map((attachment) => attachment.id));
      const missing: AssistantAttachment[] = persisted
        .filter((attachment) => !existing.has(attachment.id))
        .map((attachment) => ({
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
  }, [assistantStorageReady, data.attachments]);

  const selectedScenarios = scenarios.filter((scenario) => data.selected.includes(scenario.id));
  const selectedCustomFeatures = data.customFeatures;
  const selectedFieldItems = selectedScenarios.flatMap((scenario) => {
    const feature = mapV1Content.payload.features.find((item) => item.key === scenario.id);
    return (feature?.fields ?? scenario.fields.map((label) => ({ key: label, label })))
      .map((field) => ({ id: `${scenario.id}.${field.key}`, featureId: scenario.id, feature: scenario.title, label: field.label }));
  });
  const fieldAnswer = (fieldId: string) => resolveFieldAnswer(data, fieldId);
  const processedFieldCount = selectedFieldItems.filter((field) => fieldAnswer(field.id) === "PROCESS").length
    + data.processingActivities
      .filter((activity) => activity.featureKey.startsWith("custom:") && data.customFeatures.includes(activity.title))
      .reduce((total, activity) => total + new Set([...activity.informationItems, ...activity.informationOther]).size, 0)
    + data.processingActivities
      .filter((activity) => data.selected.includes(activity.featureKey))
      .reduce((total, activity) => total + activity.informationOther.length, 0);
  const selectedDetailsComplete = selectedScenarios.every((scenario) => {
    const detail = data.activityDetails[scenario.id];
    return Boolean(detail?.purpose.trim());
  }) && selectedCustomFeatures.every((feature) => {
    const detail = data.customDetails[feature];
    return Boolean(detail?.purpose.trim());
  });
  const basicProfileComplete = basicProfileFields.every(([key]) => Boolean(data.profile[key]?.trim()));
  const profileComplete = profileFields
    .filter(([key]) => key !== "contactPhone")
    .every(([key]) => Boolean(data.profile[key]?.trim()));
  const supplementQuestions = getRequiredSupplementQuestions({ selected: data.selected, customFeatures: data.customFeatures, supplementAnswers: data.supplementAnswers });
  const effectiveSupplementAnswers = Object.fromEntries(supplementQuestions.map((question) => [
    question.id,
    data.supplementAnswers[question.id] ?? { answer: "NO" as const, detail: "", slots: {} },
  ]));
  const isSupplementComplete = (question: (typeof supplementQuestions)[number]) => {
    const answer = effectiveSupplementAnswers[question.id];
    if (answer.answer === "UNKNOWN") return false;
    if (answer.answer === "NO") return true;
    const slotScenario = getSlotScenario(question.id);
    if (!slotScenario) return Boolean(answer.detail.trim());
    return slotScenario.slots.filter((slot) => slot.required).every((slot) => {
      const value = answer.slots?.[slot.id];
      if (!value || !value.value.trim() || value.status !== "CONFIRMED") return false;
      if (slot.inputType === "url") {
        try {
          const url = new URL(value.value);
          if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        } catch {
          return false;
        }
      }
      return true;
    });
  };
  const completedSupplementCount = supplementQuestions.filter(isSupplementComplete).length;
  const formalReadiness = evaluateFormalPolicyReadiness({
    profile: data.profile as unknown as FormPayload["profile"],
    selected: data.selected,
    customFeatures: data.customFeatures,
    customDetails: data.customDetails,
    activityDetails: data.activityDetails,
    confirmedFields: data.confirmedFields,
    fieldAnswers: data.fieldAnswers,
    additionalNotes: data.additionalNotes,
    supplementAnswers: effectiveSupplementAnswers,
  });
  const warningCount = selectedScenarios.filter((scenario) => scenario.risk).length;
  const hasBasicFeature = data.selected.some((feature) => BASIC_FEATURE_IDS.has(feature))
    || data.processingActivities.some((activity) => activity.kind === "BASIC" && data.customFeatures.includes(activity.title));
  const canReview = basicProfileComplete && hasBasicFeature && selectedDetailsComplete && processedFieldCount > 0;
  const permissionDetailsComplete = data.permissions.length === 0
    || data.permissions.every((permission) => Boolean(permission.label.trim()) && (permission.scenes.length > 0 || Boolean(permission.sceneOther.trim())));
  const storageDetailsComplete = Boolean(
    data.storageAndSecurity.locations?.length
    && data.storageAndSecurity.retentionPolicies?.length
    && data.storageAndSecurity.expiryActions?.length
    && (!data.storageAndSecurity.locations.includes("OVERSEAS") || data.storageAndSecurity.crossBorderDetail?.trim())
    && (!data.storageAndSecurity.retentionPolicies.includes("FIXED_PERIOD") || data.storageAndSecurity.fixedPeriod?.trim())
    && (!data.storageAndSecurity.expiryActions.includes("OTHER") || data.storageAndSecurity.expiryOther?.trim())
    && data.profile.securityMeasures?.trim(),
  );
  const canGenerate = canReview && profileComplete && formalReadiness.ready;
  // 直链守卫：任何一步不满足都回到“最先不完整”的步骤，与侧边栏守卫保持一致。
  const firstIncompleteStep: StepIndex = !basicProfileComplete ? 0 : !data.selected.length || !selectedDetailsComplete || processedFieldCount === 0 ? 1 : !permissionDetailsComplete ? 2 : !data.supplementAnswers["third-party-services"] ? 3 : !data.supplementAnswers["storage-locations"] || !data.profile.securityMeasures?.trim() ? 4 : 5;
  // 客户界面只展示该项目最新一份成功政策；历史快照仍由服务端保留。
  // 不在浏览器内重做两套表单 schema 的等价判断，避免刚生成的 Word 被误隐藏。
  const latestSuccessfulHistory = (history ?? [])
    .filter((item) => item.state === "SUCCEEDED" && Boolean(item.markdown && item.downloadUrl))
    .slice(0, 1);
  const selectedCount = data.selected.length + data.customFeatures.length;
  const completedSteps = [
    basicProfileComplete,
    selectedCount > 0 && selectedDetailsComplete && processedFieldCount > 0,
    permissionDetailsComplete,
    Boolean(data.supplementAnswers["third-party-services"]),
    Boolean(data.supplementAnswers["storage-locations"] && data.profile.securityMeasures?.trim()),
    data.generated?.status === "SUCCEEDED",
  ];
  const completionPercent = Math.round(completedSteps.filter(Boolean).length / completedSteps.length * 100);
  const assistantPrompt = activeStep === 0
    ? "基本信息会用于政策标题、运营主体和生效日期。"
    : activeStep === 1
      ? "按功能选择产品实际处理的个人信息和处理目的；行业示例不会自动成为产品事实。"
      : activeStep === 2
        ? "只选择产品实际调用的设备权限，并说明对应使用场景。"
        : activeStep === 3
          ? "SDK 与合作方信息需要以实际接入情况和公开隐私政策链接为准。"
          : activeStep === 4
            ? "保存期限在这里统一选择，不再按每项功能重复填写。"
            : "补齐用户权利和联系方式后，系统会检查事实、查询法规并生成政策。";
  const assistantStepFields = activeStep === 0
    ? basicProfileFields.map(([key, label]) => ({ key, label, value: data.profile[key] ?? "", required: true, complete: Boolean(data.profile[key]?.trim()) }))
    : activeStep === 1
      ? [
        { key: "basic-feature", label: "至少选择一个基本功能", value: hasBasicFeature ? "已选择" : "", required: true, complete: hasBasicFeature },
        ...selectedScenarios.flatMap((scenario) => {
          const manualInformation = data.processingActivities.find((item) => item.featureKey === scenario.id)?.informationOther ?? [];
          const selectedInformation = selectedFieldItems.filter((field) => field.featureId === scenario.id && fieldAnswer(field.id) === "PROCESS").map((field) => field.label);
          const information = [...new Set([...selectedInformation, ...manualInformation])].join("、");
          const purpose = data.activityDetails[scenario.id]?.purpose ?? "";
          return [
            { key: `${scenario.id}-information`, label: `“${scenario.title}”对应个人信息`, value: information, required: true, complete: Boolean(information) },
            { key: `${scenario.id}-purpose`, label: `“${scenario.title}”处理目的`, value: purpose, required: true, complete: Boolean(purpose.trim()) },
          ];
        }),
        ...selectedCustomFeatures.flatMap((feature) => {
          const activity = data.processingActivities.find((item) => item.featureKey === `custom:${feature}`);
          const information = [...new Set([...(activity?.informationItems ?? []), ...(activity?.informationOther ?? [])])].join("、");
          const purpose = data.customDetails[feature]?.purpose ?? "";
          return [
            { key: `custom:${feature}-information`, label: `“${feature}”对应个人信息`, value: information, required: true, complete: Boolean(information) },
            { key: `custom:${feature}-purpose`, label: `“${feature}”处理目的`, value: purpose, required: true, complete: Boolean(purpose.trim()) },
          ];
        }),
      ]
      : activeStep === 2
        ? [
          { key: "device-permissions", label: "设备权限使用情况", value: data.supplementAnswers["device-permissions"]?.answer ?? "", required: true, complete: Boolean(data.supplementAnswers["device-permissions"]) },
          { key: "permission-items", label: "实际使用的权限及场景", value: assistantFactValue(data.permissions), required: data.supplementAnswers["device-permissions"]?.answer === "YES", complete: permissionDetailsComplete },
        ]
        : activeStep === 3
          ? [
            { key: "third-party-services", label: "SDK 与合作方使用情况", value: data.supplementAnswers["third-party-services"]?.answer ?? "", required: true, complete: Boolean(data.supplementAnswers["third-party-services"]) },
            { key: "partner-items", label: "SDK 与合作方明细", value: assistantFactValue(data.partners), required: data.supplementAnswers["third-party-services"]?.answer === "YES", complete: data.supplementAnswers["third-party-services"]?.answer !== "YES" || data.partners.length > 0 },
          ]
          : activeStep === 4
            ? [
              { key: "storage-locations", label: "存储位置", value: assistantFactValue(data.storageAndSecurity.locations), required: true, complete: Boolean(data.storageAndSecurity.locations?.length) },
              { key: "retention-policies", label: "保存期限原则", value: assistantFactValue(data.storageAndSecurity.retentionPolicies), required: true, complete: Boolean(data.storageAndSecurity.retentionPolicies?.length) },
              { key: "expiry-actions", label: "期限届满后的处理方式", value: assistantFactValue(data.storageAndSecurity.expiryActions), required: true, complete: Boolean(data.storageAndSecurity.expiryActions?.length) },
              { key: "security-measures", label: "实际采取的安全措施", value: data.profile.securityMeasures ?? "", required: true, complete: Boolean(data.profile.securityMeasures?.trim()) },
            ]
            : rightsProfileFields.map(([key, label]) => ({ key, label, value: data.profile[key] ?? "", required: key !== "contactPhone", complete: key === "contactPhone" || Boolean(data.profile[key]?.trim()) }));
  const assistantProjectFacts: Array<{ section: string; label: string; value: string }> = [];
  for (const [key, label] of profileFields) {
    const value = data.profile[key]?.trim();
    if (value) assistantProjectFacts.push({ section: "基本信息与用户权利", label, value: value.slice(0, 4_000) });
  }
  for (const scenario of selectedScenarios) {
    const selectedInformation = selectedFieldItems.filter((field) => field.featureId === scenario.id && fieldAnswer(field.id) === "PROCESS").map((field) => field.label);
    const manualInformation = data.processingActivities.find((item) => item.featureKey === scenario.id)?.informationOther ?? [];
    const information = [...new Set([...selectedInformation, ...manualInformation])].join("、");
    assistantProjectFacts.push({ section: "功能与个人信息", label: scenario.title, value: `个人信息：${information || "尚未选择"}；处理目的：${data.activityDetails[scenario.id]?.purpose || "尚未填写"}` });
  }
  for (const feature of selectedCustomFeatures) {
    const activity = data.processingActivities.find((item) => item.featureKey === `custom:${feature}`);
    const information = [...new Set([...(activity?.informationItems ?? []), ...(activity?.informationOther ?? [])])].join("、");
    assistantProjectFacts.push({ section: "功能与个人信息", label: feature, value: `个人信息：${information || "尚未选择"}；处理目的：${data.customDetails[feature]?.purpose || "尚未填写"}` });
  }
  const structuredFacts: Array<[string, string, unknown]> = [
    ["设备权限", "权限清单", data.permissions],
    ["SDK 与合作方", "合作方清单", data.partners],
    ["存储与安全", "存储和安全规则", data.storageAndSecurity],
    ["用户权利", "权利与治理", data.rightsAndGovernance],
    ["补充信息", "补充问卷", data.supplementAnswers],
  ];
  for (const [section, label, source] of structuredFacts) {
    const value = assistantFactValue(source);
    if (value) assistantProjectFacts.push({ section, label, value: value.slice(0, 4_000) });
  }
  if (data.additionalNotes.trim()) assistantProjectFacts.push({ section: "补充信息", label: "其他补充信息", value: data.additionalNotes.trim().slice(0, 4_000) });
  const readyAssistantAttachments = assistantAttachments.filter((attachment) => attachment.status === "READY" && attachment.content);
  const assistantHasReadingAttachment = assistantAttachments.some((attachment) => attachment.status === "READING");

  function attachmentKindFromFile(file: File): AssistantAttachment["kind"] {
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)) return "IMAGE";
    if (extension === "csv") return "SPREADSHEET";
    if (file.type.startsWith("text/") || ["txt", "md", "markdown", "json"].includes(extension)) return "TEXT";
    return "DOCUMENT";
  }

  async function readAssistantAttachment(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/assistant/attachments", {
        method: "POST",
        headers: { "x-persona-id": CLIENT_PERSONA_ID },
        body,
      });
      const payload = await response.json().catch(() => null) as {
        name?: string;
        mimeType?: string;
        size?: number;
        kind?: AssistantAttachment["kind"];
        text?: string;
        truncated?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !payload?.text || !payload.kind) throw new Error(payload?.message || "文件读取失败。");
      setAssistantAttachments((current) => {
        const otherTextLength = current.filter((attachment) => attachment.id !== id && attachment.status === "READY").reduce((sum, attachment) => sum + (attachment.content?.length ?? 0), 0);
        if (otherTextLength + payload.text!.length > 60_000) {
          return current.map((attachment) => attachment.id === id ? { ...attachment, status: "FAILED", error: "附件可读内容总量已达上限，请先删除其他文件。", content: undefined } : attachment);
        }
        return current.map((attachment) => attachment.id === id ? {
          ...attachment,
          name: payload.name ?? attachment.name,
          mimeType: payload.mimeType ?? attachment.mimeType,
          size: payload.size ?? attachment.size,
          kind: payload.kind!,
          status: "READY",
          content: payload.text,
          truncated: payload.truncated,
          error: undefined,
        } : attachment);
      });
    } catch (error) {
      setAssistantAttachments((current) => current.map((attachment) => attachment.id === id ? {
        ...attachment,
        status: "FAILED",
        error: error instanceof Error ? error.message : "文件读取失败。",
      } : attachment));
    }
  }

  function handleAssistantFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = Math.max(0, 5 - assistantAttachments.length);
    if (remaining === 0) {
      setStatusMessage("每次最多上传 5 个文件，请先删除不需要的附件");
      return;
    }
    const accepted = Array.from(files).slice(0, remaining);
    if (files.length > remaining) setStatusMessage(`已加入前 ${remaining} 个文件，单次最多 5 个`);
    const staged = accepted.map((file) => {
      const id = `attachment-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
      const item: AssistantAttachment = {
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        kind: attachmentKindFromFile(file),
        status: "READING",
        useForFormFilling: false,
        ...(file.type.startsWith("image/") ? { previewUrl: URL.createObjectURL(file) } : {}),
      };
      return { file, item };
    });
    setAssistantAttachments((current) => [...current, ...staged.map(({ item }) => item)]);
    setAttachmentsCollapsed(false);
    for (const { file, item } of staged) void readAssistantAttachment(item.id, file);
  }

  function removeAssistantAttachment(id: string) {
    setAssistantAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
    commit({ attachments: dataRef.current.attachments.filter((attachment) => attachment.id !== id) }, "资料已移除");
  }

  function toggleAssistantAttachmentFactUse(id: string) {
    const nextAttachments = assistantAttachments.map((attachment) => attachment.id === id
      ? { ...attachment, useForFormFilling: !attachment.useForFormFilling }
      : attachment);
    setAssistantAttachments(nextAttachments);
    commit({
      attachments: nextAttachments
        .filter((attachment) => attachment.status === "READY")
        .map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          kind: attachment.kind,
          status: attachment.useForFormFilling ? "CONFIRMED" as const : "PENDING" as const,
          mimeType: attachment.mimeType,
          size: attachment.size,
          content: attachment.useForFormFilling ? (attachment.content ?? "") : "",
          truncated: attachment.truncated ?? false,
        })),
    }, "附件用途已保存；只有标记为本产品资料的内容可用于补充建议");
  }

  function assistantMessageId(role: AssistantMessage["role"]) {
    return `${role}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
  }

  async function sendAssistantMessage(prompt = assistantInput, appendUserMessage = true) {
    const content = prompt.trim() || (readyAssistantAttachments.length > 0 ? "请阅读已上传资料，说明其中与当前项目隐私政策相关的要点，并指出可能需要补充的表单信息。" : "");
    if (!content || assistantSending || assistantHasReadingAttachment) return;
    const userMessage: AssistantMessage = { id: assistantMessageId("user"), role: "user", content, attachmentNames: readyAssistantAttachments.map((attachment) => attachment.name) };
    const conversation = (appendUserMessage ? [...assistantMessages, userMessage] : assistantMessages).slice(-20);
    if (appendUserMessage) setAssistantMessages(conversation);
    setAssistantInput("");
    setAssistantError(null);
    setAssistantSending(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
        body: JSON.stringify({
          messages: conversation.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          projectContext: {
            currentStep: `${steps[activeStep]}：${assistantPrompt}`,
            productName: data.profile.productName ?? "",
            operatorName: data.profile.operatorName ?? "",
            selectedFeatures: [
              ...selectedScenarios.map((scenario) => ({
                name: scenario.title,
                purpose: data.activityDetails[scenario.id]?.purpose ?? "",
              })),
              ...selectedCustomFeatures.map((name) => ({
                name,
                purpose: data.customDetails[name]?.purpose ?? "",
              })),
            ],
            processedInformation: selectedFieldItems.filter((field) => fieldAnswer(field.id) === "PROCESS").map((field) => `${field.feature}：${field.label}`),
            additionalNotes: data.additionalNotes,
            currentStepFields: assistantStepFields,
            projectFacts: assistantProjectFacts,
          },
          attachments: readyAssistantAttachments.map((attachment) => ({
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
        id: assistantMessageId("assistant"),
        role: "assistant",
        content: payload.answer!,
        suggestedText: payload.suggestedText,
        suggestionTarget: payload.suggestionTarget,
      };
      setAssistantMessages((current) => [...current, assistantMessage].slice(-20));
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "AI 助手暂时无法回答，请稍后重试。");
    } finally {
      setAssistantSending(false);
    }
  }

  function applyAssistantSuggestion(message: AssistantMessage) {
    if (!message.suggestedText || message.applied) return;
    const target = message.suggestionTarget;
    const scenario = target?.featureName ? scenarios.find((item) => item.title === target.featureName) : undefined;
    const customFeature = target?.featureName && dataRef.current.customFeatures.includes(target.featureName) ? target.featureName : undefined;
    if (target?.kind === "FEATURE_INFORMATION" && (scenario || customFeature)) {
      const featureKey = scenario?.id ?? `custom:${customFeature!}`;
      const current = dataRef.current.processingActivities.find((item) => item.featureKey === featureKey)
        ?? { featureKey, title: target.featureName!, kind: scenario ? (BASIC_FEATURE_IDS.has(scenario.id) ? "BASIC" as const : "EXTENSION" as const) : "CUSTOM" as const, informationItems: [], informationOther: [], purposes: [], purposeOther: "" };
      const informationOther = [...new Set([...current.informationOther, message.suggestedText.trim()])];
      commit({ processingActivities: [...dataRef.current.processingActivities.filter((item) => item.featureKey !== featureKey), { ...current, informationOther }] }, `已填入“${target.featureName}”的其他个人信息，请核对`);
    } else if (target?.kind === "FEATURE_PURPOSE" && scenario) {
      const current = dataRef.current.activityDetails[scenario.id] ?? { purpose: "" };
      const purpose = [...new Set([...current.purpose.split("；").filter(Boolean), message.suggestedText.trim()])].join("；");
      commit({ activityDetails: { ...dataRef.current.activityDetails, [scenario.id]: { ...current, purpose } } }, `已填入“${target.featureName}”的处理目的，请核对`);
    } else if (target?.kind === "FEATURE_PURPOSE" && customFeature) {
      const current = dataRef.current.customDetails[customFeature] ?? { purpose: "" };
      const purpose = [...new Set([...current.purpose.split("；").filter(Boolean), message.suggestedText.trim()])].join("；");
      commit({ customDetails: { ...dataRef.current.customDetails, [customFeature]: { ...current, purpose } } }, `已填入“${target.featureName}”的处理目的，请核对`);
    } else {
      const nextNotes = [dataRef.current.additionalNotes.trim(), message.suggestedText.trim()].filter(Boolean).join("\n\n");
      commit({ additionalNotes: nextNotes }, "内容已加入其他补充信息，请核对");
    }
    setAssistantMessages((current) => current.map((item) => item.id === message.id ? { ...item, applied: true } : item));
  }

  function clearAssistantConversation() {
    if (assistantSending) return;
    setAssistantMessages([]);
    setAssistantInput("");
    setAssistantError(null);
  }

  async function copyAssistantMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setStatusMessage("回答已复制");
    } catch {
      setStatusMessage("复制失败，请手动选择文本");
    }
  }

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [assistantMessages, assistantSending]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);

    // 已创建项目必须先完成服务端水合，再启用自动保存。否则空白初始状态
    // 会在 MySQL 返回前抢先 PUT，覆盖 POST 创建时保存的范围答案。
    if (projectId) {
      loadProjectFromServer(projectId).then((server) => {
        if (cancelled) return;
        if (!server) {
          setStatusMessage("项目数据加载失败，请刷新后重试");
          setActiveStep(0);
          setHydrated(true);
          return;
        }
        const serverFormIsEmpty = (server.formData.processingActivities?.length ?? 0) === 0 && Object.keys(server.formData.profile ?? {}).length === 0;
        const hydratedForm = developmentPrefillEnabled && serverFormIsEmpty ? initialProject : server.formData;
        const serverData: ProjectData = {
          ...emptyProject,
          ...hydratedForm,
          projectId,
          revision: server.revision,
          generated: undefined,
        };
        // 空项目在开发期装载示例数据后应触发一次自动保存；否则刷新页面又会回到空表单。
        lastSavedKeyRef.current = computeFormKey({ ...emptyProject, ...server.formData, projectId, revision: server.revision });
        lastSavedStepRef.current = server.currentStepKey;
        dataRef.current = serverData;
        setData(serverData);
        const firstIncomplete = firstIncompleteFor(serverData);
        setActiveStep(initialStep > firstIncomplete ? firstIncomplete : initialStep);
        setHydrated(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const canonical = canonicalizeProjectFormData(JSON.parse(saved));
        const parsed = toWorkspaceCompatibilityState(canonical) as Partial<ProjectData>;
        const restored: ProjectData = {
          ...initialProject,
          ...parsed,
          projectId: parsed.projectId ?? null,
          profile: parsed.profile ?? {},
          selected: parsed.selected ?? [],
          customFeatures: parsed.customFeatures ?? [],
          customDetails: parsed.customDetails ?? {},
          additionalNotes: parsed.additionalNotes ?? "",
          confirmedFields: parsed.confirmedFields ?? [],
          fieldAnswers: parsed.fieldAnswers ?? {},
          activityDetails: parsed.activityDetails ?? {},
          supplementAnswers: parsed.supplementAnswers ?? {},
          generatedMarkdown: parsed.generatedMarkdown ?? "",
        };
        dataRef.current = restored;
        setData(restored);
      } catch {
        setStatusMessage("本地项目表单无法读取，已创建空白填写页");
      }
    }
    setHydrated(true);

    return () => {
      cancelled = true;
    };
  }, [projectId, storageKey]);

  // 步骤由“水合 + 守卫”共同决定；直接链接进入不完整步骤会被守卫回退。
  // 不再无条件 setActiveStep(initialStep)，避免与守卫抢步，导致点“保存并选择功能”
  // 后又被拉回上一个步骤。
  useEffect(() => {
    if (!hydrated) return;
    if (initialStep > firstIncompleteStep) {
      setActiveStep(firstIncompleteStep);
      // 直链守卫：URL 与回退后的实际步骤保持一致，避免 /features 显示 scope 内容。
      if (data.projectId) router.replace(`/projects/${data.projectId}/${workspaceSlugFor(firstIncompleteStep)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, initialStep, firstIncompleteStep, data.projectId]);

  // 未创建项目的草稿先写进 localStorage，创建成功（POST 返回 id）后再挂到项目保存。
  useEffect(() => {
    if (!hydrated || data.projectId) return;
    try {
      window.localStorage.setItem(projectStorageKey(undefined), JSON.stringify(toProjectFormData(data)));
    } catch {
      // 忽略隐私模式/配额异常，不打断填写。
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, data]);
  useEffect(() => {
    if (!hydrated || !data.projectId || !formKey) return;
    if (lastSavedKeyRef.current === formKey) return;
    const projectId = data.projectId;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
          body: JSON.stringify({ expectedRevision: data.revision, formData: toProjectFormData(data), currentStepKey: workspaceSlugFor(activeStep) }),
        });
        if (res.status === 409) {
          setStatusMessage("项目已在其他页面更新，已重新载入最新版本");
          const server = await loadProjectFromServer(projectId);
          if (server) {
            lastSavedKeyRef.current = computeFormKey(server.formData);
            lastSavedStepRef.current = server.currentStepKey;
            setData({ ...emptyProject, ...server.formData, projectId, revision: server.revision, generated: undefined });
          }
          return;
        }
        if (!res.ok) throw new Error("保存失败");
        const payload = await res.json() as { data: { revision: number } };
        lastSavedKeyRef.current = formKey;
        lastSavedStepRef.current = workspaceSlugFor(activeStep);
        setData((current) => ({ ...current, revision: payload.data.revision }));
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setStatusMessage("保存到服务器失败，请检查 MySQL 是否可用");
      }
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, hydrated, data.projectId, data.revision]);

  // 最后一步只展示当前项目最新一份可用报告。
  useEffect(() => {
    if (activeStep !== 5 || !data.projectId) return;
    fetch(`/api/v1/projects/${data.projectId}`, { headers: { "x-persona-id": CLIENT_PERSONA_ID } })
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = await res.json() as { data: { latestReport: { id: string; createdAt: string; previewUrl: string; downloadUrl: string } | null } };
        if (!payload.data.latestReport) return null;
        const reportResponse = await fetch(payload.data.latestReport.previewUrl, { headers: { "x-persona-id": CLIENT_PERSONA_ID } });
        if (!reportResponse.ok) return null;
        const reportPayload = await reportResponse.json() as { data: { id: string; createdAt: string; markdown: string; downloadUrl: string } };
        return { ...reportPayload.data, state: "SUCCEEDED" } as SnapshotItem;
      })
      .then((latest) => setHistory(latest ? [latest] : []))
      .catch(() => setHistory([]));
  }, [activeStep, data.projectId, data.generated?.status]);

  function commit(next: Partial<ProjectData>, message = "已保存") {
    const touchesGenerated = "generated" in next;
    // 非生成动作（用户修改表单）必须失效已生成的草稿，避免下载/预览与当前确认事实不一致的旧文档。
    const changes = touchesGenerated ? next : { ...next, generated: undefined, generatedMarkdown: "" };
    const merged = { ...dataRef.current, ...changes };
    dataRef.current = merged; // 同步最新值，保证 persistNow / goToStep 导航前 flush 不丢改动。
    setData(merged);
    setStatusMessage(message);
  }

  async function ensureProjectId(): Promise<string> {
    if (data.projectId) return data.projectId;
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
      body: JSON.stringify({
        categoryKey: "map-navigation",
        idempotencyKey: `project-create-${typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
        formData: toProjectFormData(dataRef.current),
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message || "项目创建失败，请检查数据库连接");
    }
    const payload = await res.json() as { data: { id: string; revision: number } };
    lastSavedKeyRef.current = formKey;
    lastSavedStepRef.current = "profile";
    const mergedProject = { ...dataRef.current, projectId: payload.data.id, revision: payload.data.revision };
    dataRef.current = mergedProject;
    setData(mergedProject);
    try {
      window.sessionStorage.setItem(`privacy-policy-assistant:v3:${payload.data.id}`, JSON.stringify({
        messages: assistantMessages.slice(-20),
        attachments: assistantAttachments.filter((attachment) => attachment.status === "READY").map(({ previewUrl: _previewUrl, ...attachment }) => attachment),
      }));
      window.sessionStorage.removeItem("privacy-policy-assistant:v3:new");
    } catch {
      // 不影响项目创建。
    }
    // 草稿已落库，清理本地占位草稿，避免下次进入“创建”页误读旧内容。
    try {
      window.localStorage.removeItem(projectStorageKey(undefined));
    } catch {
      // 忽略。
    }
    return payload.data.id;
  }

  async function goToStep(step: StepIndex) {
    if (step > 0 && !basicProfileComplete) {
      setStatusMessage("请先完成产品和运营主体的基本信息");
      setActiveStep(0);
      return;
    }
    if (step > 1 && (!data.selected.length || !selectedDetailsComplete || processedFieldCount === 0)) {
      setStatusMessage("请先按功能选择个人信息并确认处理目的");
      setActiveStep(1);
      return;
    }
    if (step > 2 && !permissionDetailsComplete) {
      setStatusMessage("请先确认设备权限及对应使用场景");
      setActiveStep(2);
      return;
    }
    if (step > 3 && !data.supplementAnswers["third-party-services"]) {
      setStatusMessage("请先确认 SDK 与合作方情况");
      setActiveStep(3);
      return;
    }
    if (step > 4 && (!data.supplementAnswers["storage-locations"] || !data.profile.securityMeasures?.trim())) {
      setStatusMessage("请先确认统一存储规则和实际安全措施");
      setActiveStep(4);
      return;
    }
    // 步骤切换可能触发客户端组件重挂载（路由段变化），重挂载后按服务器数据
    // 水合。必须先把未落库的最新填写 flush 到服务器，否则守卫会因读到旧数据
    // 把用户弹回上一个未完成步骤。
    const id = dataRef.current.projectId;
    if (id) {
      const saved = await persistNow(workspaceSlugFor(step));
      if (!saved.ok) {
        setStatusMessage("保存到服务器失败，请稍后重试");
        return;
      }
      setActiveStep(step);
      router.push(`/projects/${id}/${workspaceSlugFor(step)}`);
      return;
    }
    setActiveStep(step);
  }

  async function handleSaveAndExit() {
    if (!data.projectId) {
      setStatusMessage("项目尚未创建");
      router.push("/");
      return;
    }
    try {
      await ensureProjectId();
      const saved = await persistNow();
      setStatusMessage(saved.ok ? "已保存，正在返回项目列表" : "保存失败，请稍后重试");
      router.push("/projects");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "项目创建失败");
    }
  }

  function toggleExplainer() {
    setExplainerOpen((open) => !open);
  }

  function updateProfile(field: string, value: string) {
    commit({ profile: { ...data.profile, [field]: value } }, "通用信息已保存");
  }

  function toggleProfilePreset(field: string, value: string, multiple = false) {
    if (!multiple) {
      updateProfile(field, data.profile[field as keyof typeof data.profile] === value ? "" : value);
      return;
    }
    const current = String(data.profile[field as keyof typeof data.profile] ?? "").split("、").map((item) => item.trim()).filter(Boolean);
    updateProfile(field, current.includes(value) ? current.filter((item) => item !== value).join("、") : [...current, value].join("、"));
  }

  function updateProfileOther(field: string, presets: readonly string[], value: string, multiple = false) {
    if (!multiple) {
      updateProfile(field, value);
      return;
    }
    const current = String(data.profile[field as keyof typeof data.profile] ?? "").split("、").map((item) => item.trim()).filter(Boolean);
    const selectedPresets = current.filter((item) => presets.includes(item));
    const other = value.split(/[、，,；;\n]/).map((item) => item.trim()).filter(Boolean);
    updateProfile(field, [...selectedPresets, ...other].join("、"));
  }

  function toggleFeature(id: string) {
    const selected = data.selected.includes(id) ? data.selected.filter((item) => item !== id) : [...data.selected, id];
    const details = { ...data.activityDetails };
    if (!selected.includes(id)) delete details[id];
    commit({ selected, activityDetails: details, confirmedFields: data.confirmedFields.filter((field) => !field.startsWith(`${id}.`)), fieldAnswers: Object.fromEntries(Object.entries(data.fieldAnswers).filter(([field]) => !field.startsWith(`${id}.`))) }, "功能选择已保存");
  }

  function updateActivityDetail(id: string, field: keyof ActivityDetail, value: string) {
    const current = data.activityDetails[id] ?? { purpose: "" };
    commit({ activityDetails: { ...data.activityDetails, [id]: { ...current, [field]: value } } }, "处理活动详情已保存");
  }

  function togglePurposePreset(id: string, purpose: string) {
    const current = data.activityDetails[id] ?? { purpose: "" };
    const values = current.purpose.split("；").map((item) => item.trim()).filter(Boolean);
    const next = values.includes(purpose) ? values.filter((item) => item !== purpose) : [...values, purpose];
    updateActivityDetail(id, "purpose", next.join("；"));
  }

  function updatePurposeOther(id: string, value: string) {
    const current = data.activityDetails[id] ?? { purpose: "" };
    const presets = PURPOSE_PRESETS[id] ?? [];
    const selectedPresets = current.purpose.split("；").map((item) => item.trim()).filter((item) => presets.includes(item));
    const other = value.split(/[；\n]/).map((item) => item.trim()).filter(Boolean);
    updateActivityDetail(id, "purpose", [...selectedPresets, ...other].join("；"));
  }

  function updateInformationOther(featureKey: string, title: string, kind: "BASIC" | "EXTENSION" | "CUSTOM", value: string) {
    const current = data.processingActivities.find((item) => item.featureKey === featureKey)
      ?? { featureKey, title, kind, informationItems: [], informationOther: [], purposes: [], purposeOther: "" };
    const informationOther = value.split(/[、，,；;\n]/).map((item) => item.trim()).filter(Boolean);
    const next = { ...current, informationOther };
    commit({ processingActivities: [...data.processingActivities.filter((item) => item.featureKey !== featureKey), next] }, "其他个人信息已保存");
  }

  function togglePresetFeature(feature: (typeof PRESET_ADDITIONAL_FEATURES)[number]) {
    const selected = data.customFeatures.includes(feature.title);
    const featureKey = `custom:${feature.title}`;
    if (selected) {
      commit({
        customFeatures: data.customFeatures.filter((item) => item !== feature.title),
        customDetails: Object.fromEntries(Object.entries(data.customDetails).filter(([key]) => key !== feature.title)),
        processingActivities: data.processingActivities.filter((item) => item.featureKey !== featureKey),
      }, "功能已移除");
      return;
    }
    commit({
      customFeatures: [...data.customFeatures, feature.title],
      customDetails: { ...data.customDetails, [feature.title]: { purpose: "" } },
      processingActivities: [
        ...data.processingActivities.filter((item) => item.featureKey !== featureKey),
        { featureKey, title: feature.title, kind: feature.kind, informationItems: [], informationOther: [], purposes: [], purposeOther: "" },
      ],
    }, "功能已选择，请继续确认个人信息和处理目的");
  }

  function removeCustomFeature(feature: string) {
    commit({
      customFeatures: data.customFeatures.filter((item) => item !== feature),
      customDetails: Object.fromEntries(Object.entries(data.customDetails).filter(([key]) => key !== feature)),
      processingActivities: data.processingActivities.filter((item) => item.featureKey !== `custom:${feature}`),
    }, "自定义功能已删除");
  }

  function toggleCustomInformationPreset(feature: string, informationItem: string) {
    const key = `custom:${feature}`;
    const current = data.processingActivities.find((item) => item.featureKey === key)
      ?? { featureKey: key, title: feature, kind: "CUSTOM" as const, informationItems: [], informationOther: [], purposes: [], purposeOther: "" };
    const informationItems = current.informationItems.includes(informationItem)
      ? current.informationItems.filter((item) => item !== informationItem)
      : [...current.informationItems, informationItem];
    commit({ processingActivities: [...data.processingActivities.filter((item) => item.featureKey !== key), { ...current, informationItems }] }, "个人信息选项已保存");
  }

  function toggleCustomPurposePreset(feature: string, purpose: string) {
    const current = data.customDetails[feature] ?? { purpose: "" };
    const purposes = current.purpose.split("；").map((item) => item.trim()).filter(Boolean);
    const next = purposes.includes(purpose) ? purposes.filter((item) => item !== purpose) : [...purposes, purpose];
    updateCustomPurpose(feature, next.join("；"), "处理目的已保存");
  }

  function updateCustomPurposeOther(feature: string, value: string) {
    const current = data.customDetails[feature] ?? { purpose: "" };
    const preset = PRESET_ADDITIONAL_FEATURES.find((item) => item.title === feature);
    const options: readonly string[] = preset?.purposes ?? [];
    const selectedPresets = current.purpose.split("；").map((item) => item.trim()).filter((item) => options.includes(item));
    const other = value.split(/[；\n]/).map((item) => item.trim()).filter(Boolean);
    updateCustomPurpose(feature, [...selectedPresets, ...other].join("；"), "其他处理目的已保存");
  }

  function updateCustomPurpose(feature: string, purpose: string, message: string) {
    const featureKey = `custom:${feature}`;
    const existing = data.processingActivities.find((item) => item.featureKey === featureKey)
      ?? { featureKey, title: feature, kind: "CUSTOM" as const, informationItems: [], informationOther: [], purposes: [], purposeOther: "" };
    commit({
      customDetails: { ...data.customDetails, [feature]: { purpose } },
      processingActivities: [
        ...data.processingActivities.filter((item) => item.featureKey !== featureKey),
        { ...existing, purposes: purpose ? [purpose] : [], purposeOther: "" },
      ],
    }, message);
  }

  function togglePermission(preset: (typeof PERMISSION_PRESETS)[number]) {
    const exists = data.permissions.some((item) => item.key === preset.key);
    const permissions = exists ? data.permissions.filter((item) => item.key !== preset.key) : [...data.permissions, { key: preset.key, label: preset.label, scenes: [], sceneOther: "" }];
    const detail = permissions.length ? permissions.map((item) => `${item.label}：${[...item.scenes, item.sceneOther].filter(Boolean).join("、")}`).join("；") : "产品不调用设备权限";
    commit({ permissions, supplementAnswers: { ...data.supplementAnswers, "device-permissions": { answer: permissions.length ? "YES" : "NO", detail, slots: {} } } }, "设备权限已保存");
  }

  function addCustomPermission() {
    const permissions = [...data.permissions, { key: `custom:${Date.now().toString(36)}`, label: "", scenes: [], sceneOther: "" }];
    commit({ permissions, supplementAnswers: { ...data.supplementAnswers, "device-permissions": { answer: "YES", detail: "", slots: {} } } }, "已添加其他设备权限");
  }

  function updateCustomPermission(key: string, patch: { label?: string; sceneOther?: string }) {
    const permissions = data.permissions.map((item) => item.key === key ? { ...item, ...patch } : item);
    const detail = permissions.map((item) => `${item.label || "其他设备权限"}：${[...item.scenes, item.sceneOther].filter(Boolean).join("、")}`).join("；");
    commit({ permissions, supplementAnswers: { ...data.supplementAnswers, "device-permissions": { answer: permissions.length ? "YES" : "NO", detail, slots: {} } } }, "其他设备权限已保存");
  }

  function removePermission(key: string) {
    const permissions = data.permissions.filter((item) => item.key !== key);
    const detail = permissions.map((item) => `${item.label}：${[...item.scenes, item.sceneOther].filter(Boolean).join("、")}`).join("；");
    commit({ permissions, supplementAnswers: { ...data.supplementAnswers, "device-permissions": { answer: permissions.length ? "YES" : "NO", detail, slots: {} } } }, "设备权限已移除");
  }

  function togglePermissionScene(key: string, scene: string) {
    const permissions = data.permissions.map((item) => item.key === key
      ? { ...item, scenes: item.scenes.includes(scene) ? item.scenes.filter((value) => value !== scene) : [...item.scenes, scene] }
      : item);
    const detail = permissions.map((item) => `${item.label}：${[...item.scenes, item.sceneOther].filter(Boolean).join("、")}`).join("；");
    commit({ permissions, supplementAnswers: { ...data.supplementAnswers, "device-permissions": { answer: "YES", detail, slots: {} } } }, "权限使用场景已保存");
  }

  function updatePermissionScene(key: string, value: string) {
    const permissions = data.permissions.map((item) => item.key === key ? { ...item, sceneOther: value } : item);
    const detail = permissions.map((item) => `${item.label}：${[...item.scenes, item.sceneOther].filter(Boolean).join("、")}`).join("；");
    commit({ permissions, supplementAnswers: { ...data.supplementAnswers, "device-permissions": { answer: "YES", detail, slots: {} } } }, "权限场景已保存");
  }

  function addPartner() {
    commit({ partners: [...data.partners, { kind: "SDK", name: "", provider: "", purposes: [], informationItems: [], permissions: [], trigger: "", privacyUrl: "" }] }, "已添加一项 SDK 或合作方");
  }

  function updatePartner(index: number, patch: Partial<ProjectData["partners"][number]>) {
    const partners = data.partners.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    commit({ partners }, "SDK 与合作方信息已保存");
  }

  function removePartner(index: number) {
    commit({ partners: data.partners.filter((_, itemIndex) => itemIndex !== index) }, "已删除该项");
  }

  function togglePartnerPurpose(index: number, purpose: string) {
    const partner = data.partners[index];
    if (!partner) return;
    updatePartner(index, { purposes: partner.purposes.includes(purpose) ? partner.purposes.filter((item) => item !== purpose) : [...partner.purposes, purpose] });
  }

  function togglePartnerListValue(index: number, key: "informationItems" | "permissions", value: string) {
    const partner = data.partners[index];
    if (!partner) return;
    const current = partner[key];
    updatePartner(index, { [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  }

  function updatePartnerOtherValues(index: number, key: "purposes" | "informationItems" | "permissions", presets: readonly string[], value: string) {
    const partner = data.partners[index];
    if (!partner) return;
    const selectedPresets = partner[key].filter((item) => presets.includes(item));
    const otherValues = value.split(/[、，,；;\n]/).map((item) => item.trim()).filter(Boolean);
    updatePartner(index, { [key]: [...selectedPresets, ...otherValues] });
  }

  function confirmPartners(answer: "YES" | "NO") {
    const detail = answer === "NO" ? "当前产品未接入第三方 SDK 或合作方服务" : data.partners.map((item) => `${item.name || "未命名服务"}（${item.provider || "提供方待填写"}）：${item.purposes.join("、")}`).join("；");
    const first = data.partners[0];
    const slot = (value: string) => ({ value, status: "CONFIRMED" as const, updatedAt: new Date().toISOString() });
    const slots: SupplementAnswer["slots"] = answer === "YES" && first ? {
      "service-name": slot(first.name),
      "provider-name": slot(first.provider),
      purpose: slot(first.purposes.join("、")),
      "data-types": slot(first.informationItems.join("、")),
      "initialization-timing": slot(first.trigger),
      "privacy-policy-url": slot(first.privacyUrl),
    } : {};
    commit({ supplementAnswers: { ...data.supplementAnswers, "third-party-services": { answer, detail, slots } } }, answer === "NO" ? "已确认无第三方 SDK 或合作方" : "SDK 与合作方情况已确认");
  }

  function buildStorageConfirmation(storageAndSecurity: ProjectData["storageAndSecurity"]) {
    const locationLabels: Record<string, string> = { CN: "中华人民共和国境内", OVERSEAS: "境外", DEVICE: "设备本地", CLOUD: "云端服务器" };
    const retentionLabels: Record<string, string> = { MINIMUM_NECESSARY: "提供服务所必需的最短期限", FIXED_PERIOD: storageAndSecurity.fixedPeriod || "客户填写的固定期限", UNTIL_DELETION_OR_CLOSURE: "用户删除相关信息或注销账号前", LEGAL_REQUIREMENT: "法律法规另有要求的期限" };
    const expiryLabels: Record<string, string> = { DELETE: "删除", ANONYMIZE: "匿名化", OTHER: storageAndSecurity.expiryOther || "客户填写的其他方式" };
    const locations = (storageAndSecurity.locations ?? []).map((item) => locationLabels[item] ?? item).join("、");
    const retention = (storageAndSecurity.retentionPolicies ?? []).map((item) => retentionLabels[item] ?? item).join("、");
    const deletion = (storageAndSecurity.expiryActions ?? []).map((item) => expiryLabels[item] ?? item).join("、");
    const dataTypes = selectedFieldItems.filter((item) => fieldAnswer(item.id) === "PROCESS").map((item) => item.label).join("、") || "已选择功能涉及的个人信息";
    const slot = (slotValue: string) => ({ value: slotValue, status: "CONFIRMED" as const, updatedAt: new Date().toISOString() });
    const detail = `存储位置：${locations}；保存规则：${retention}；到期处理：${deletion}`;
    return { answer: "YES" as const, detail, slots: { "data-types": slot(dataTypes), "storage-location": slot(locations), retention: slot(retention), "deletion-method": slot(deletion) } };
  }

  function commitStorageAndSecurity(storageAndSecurity: ProjectData["storageAndSecurity"], message = "统一存储规则已保存") {
    commit({
      storageAndSecurity,
      supplementAnswers: { ...dataRef.current.supplementAnswers, "storage-locations": buildStorageConfirmation(storageAndSecurity) },
    }, message);
  }

  function toggleStorageValue<K extends "locations" | "retentionPolicies" | "expiryActions">(key: K, value: NonNullable<ProjectData["storageAndSecurity"][K]>[number]) {
    const current = (data.storageAndSecurity[key] ?? []) as Array<typeof value>;
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    commitStorageAndSecurity({ ...data.storageAndSecurity, [key]: next });
  }

  function updateStorageText(field: "fixedPeriod" | "crossBorderDetail" | "expiryOther", value: string) {
    commitStorageAndSecurity({ ...data.storageAndSecurity, [field]: value }, "存储补充信息已保存");
  }

  async function confirmStorageAndContinue() {
    const storageAndSecurity = dataRef.current.storageAndSecurity;
    commitStorageAndSecurity(storageAndSecurity);
    await goToStep(5);
  }

  function toggleSecurityMeasure(value: string) {
    const current = data.storageAndSecurity.securityMeasures ?? [];
    const securityMeasures = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    const otherMeasures = (data.profile.securityMeasures ?? "").split(/[、；\n]/).map((item) => item.trim()).filter((item) => item && !SECURITY_PRESETS.includes(item as (typeof SECURITY_PRESETS)[number]));
    commit({ storageAndSecurity: { ...data.storageAndSecurity, securityMeasures }, profile: { ...data.profile, securityMeasures: [...securityMeasures, ...otherMeasures].join("、") } }, "安全措施已保存");
  }

  function updateSecurityOther(value: string) {
    const otherMeasures = value.split(/[、；\n]/).map((item) => item.trim()).filter(Boolean);
    commit({ profile: { ...data.profile, securityMeasures: [...(data.storageAndSecurity.securityMeasures ?? []), ...otherMeasures].join("、") } }, "其他安全措施已保存");
  }

  function addCustomFeature() {
    const normalized = customName.trim();
    if (!normalized) {
      setStatusMessage("请填写自定义功能名称");
      return;
    }
    if (data.customFeatures.some((feature) => feature === normalized)) {
      setStatusMessage("该自定义功能已添加，请勿重复添加");
      return;
    }
    commit({ customFeatures: [...data.customFeatures, normalized], customDetails: { ...data.customDetails, [normalized]: { purpose: "" } } }, "自定义功能已保存");
    setCustomName("");
    setCustomOpen(false);
  }

  function toggleField(fieldId: string) {
    const selected = fieldAnswer(fieldId) === "PROCESS";
    const confirmedFields = selected ? data.confirmedFields.filter((item) => item !== fieldId) : [...new Set([...data.confirmedFields, fieldId])];
    const fieldAnswers = { ...data.fieldAnswers };
    if (selected) delete fieldAnswers[fieldId];
    else fieldAnswers[fieldId] = "PROCESS";
    commit({ fieldAnswers, confirmedFields }, selected ? "已取消该信息项" : "信息项已选择");
  }

  function updateSupplement(questionId: string, patch: Partial<SupplementAnswer>) {
    const current = data.supplementAnswers[questionId] ?? { answer: "UNKNOWN" as const, detail: "", slots: {} };
    commit({ supplementAnswers: { ...data.supplementAnswers, [questionId]: { ...current, ...patch, updatedAt: new Date().toISOString() } } }, "补充信息已保存");
  }

  function toggleQuestionDetailPreset(questionId: string, value: string, presets: readonly string[]) {
    const current = data.supplementAnswers[questionId];
    const parts = (current?.detail ?? "").split("；").map((item) => item.trim()).filter(Boolean);
    const next = parts.includes(value) ? parts.filter((item) => item !== value) : [...parts, value];
    updateSupplement(questionId, { answer: next.length ? "YES" : "NO", detail: next.join("；"), slots: {} });
  }

  function updateQuestionDetailOther(questionId: string, value: string, presets: readonly string[]) {
    const current = data.supplementAnswers[questionId];
    const selectedPresets = (current?.detail ?? "").split("；").map((item) => item.trim()).filter((item) => presets.includes(item));
    const other = value.split(/[；\n]/).map((item) => item.trim()).filter(Boolean);
    const detail = [...selectedPresets, ...other].join("；");
    updateSupplement(questionId, { answer: detail ? "YES" : "NO", detail, slots: {} });
  }

  function updateSupplementSlot(questionId: string, slotId: string, value: string, status: "CANDIDATE" | "CONFIRMED" = "CONFIRMED", evidenceText?: string) {
    const current = data.supplementAnswers[questionId] ?? { answer: "YES" as const, detail: "", slots: {} };
    const slots = { ...(current.slots ?? {}) };
    if (!value.trim()) delete slots[slotId];
    else slots[slotId] = { value, status, evidenceText, updatedAt: new Date().toISOString() };
    updateSupplement(questionId, { answer: Object.keys(slots).length || current.detail.trim() ? "YES" : "NO", slots });
  }

  function toggleSupplementSlotPreset(questionId: string, slotId: string, value: string, presets: readonly string[]) {
    const current = data.supplementAnswers[questionId]?.slots?.[slotId]?.value ?? "";
    const parts = current.split("；").map((item) => item.trim()).filter(Boolean);
    const next = parts.includes(value) ? parts.filter((item) => item !== value) : [...parts, value];
    updateSupplementSlot(questionId, slotId, next.join("；"));
  }

  function updateSupplementSlotOther(questionId: string, slotId: string, value: string, presets: readonly string[]) {
    const current = data.supplementAnswers[questionId]?.slots?.[slotId]?.value ?? "";
    const selectedPresets = current.split("；").map((item) => item.trim()).filter((item) => presets.includes(item));
    const other = value.split(/[；\n]/).map((item) => item.trim()).filter(Boolean);
    updateSupplementSlot(questionId, slotId, [...selectedPresets, ...other].join("；"));
  }

  async function extractSupplementSlots(questionId: string) {
    const answer = data.supplementAnswers[questionId];
    if (!answer?.detail.trim()) {
      setStatusMessage("请先用一段话描述产品实际情况，再使用智能整理");
      return;
    }
    setExtractingQuestionId(questionId);
    setStatusMessage("正在从描述中整理可填写内容");
    try {
      const response = await fetch("/api/knowledge/extract-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
        body: JSON.stringify({ questionId, detail: answer.detail }),
      });
      const payload = await response.json().catch(() => null) as { message?: string; candidates?: Array<{ slotId: string; value: string; evidenceText: string }> } | null;
      if (!response.ok) throw new Error(payload?.message || "智能整理暂时不可用，请直接填写下方字段");
      const slots = { ...(answer.slots ?? {}) };
      for (const candidate of payload?.candidates ?? []) {
        if (slots[candidate.slotId]?.status === "CONFIRMED") continue;
        slots[candidate.slotId] = { value: candidate.value, status: "CANDIDATE", evidenceText: candidate.evidenceText, updatedAt: new Date().toISOString() };
      }
      updateSupplement(questionId, { slots });
      setStatusMessage((payload?.candidates?.length ?? 0) > 0 ? "已整理出可填写内容，请核对后采用或修改" : "描述中没有足够明确的事实，请直接填写下方字段");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "智能整理暂时不可用，请直接填写下方字段");
    } finally {
      setExtractingQuestionId(null);
    }
  }

  async function runDraftGeneration(id: string, idempotencyKey: string) {
    setPreflightIssues([]);
    const startedAt = Date.now();
    setLiveGeneration({
      startedAt,
      stages: INITIAL_GENERATION_STAGES.map((stage) => ({ ...stage, status: "WAITING" })),
      completedSections: 0,
      totalSections: 8,
      currentSection: "任务已加入生成队列",
      characterCount: 0,
      phase: "THINKING",
      activityCount: 0,
    });
    setGenerationElapsed(0);

    try {
      const response = await fetch(`/api/v1/projects/${id}/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
        body: JSON.stringify({ idempotencyKey }),
      });
      const created = await response.json() as { data?: GenerationJobPayload; error?: { message?: string } };
      if (!response.ok || !created.data) throw new Error(created.error?.message || "生成任务创建失败");
      const generationId = created.data.id;
      commit({ generated: { status: "GENERATING", generationId, createdAt: created.data.createdAt }, generatedMarkdown: "" }, "任务已加入生成队列");

      for (;;) {
        const poll = await fetch(`/api/v1/projects/${id}/generations/${generationId}`, {
          headers: { "x-persona-id": CLIENT_PERSONA_ID },
          cache: "no-store",
        });
        const payload = await poll.json() as { data?: GenerationJobPayload; error?: { message?: string } };
        if (!poll.ok || !payload.data) throw new Error(payload.error?.message || "生成状态加载失败");
        const job = payload.data;
        const currentStageIndex = INITIAL_GENERATION_STAGES.findIndex((stage) => stage.key === job.stage);
        setLiveGeneration((current) => current ? {
          ...current,
          stages: current.stages.map((stage, index) => ({
            ...stage,
            status: job.state === "FAILED" && index === currentStageIndex ? "FAILED"
              : index < currentStageIndex || job.stage === "COMPLETED" ? "COMPLETED"
                : index === currentStageIndex ? "ACTIVE" : "WAITING",
            message: index === currentStageIndex && job.progress?.message ? job.progress.message : stage.message,
          })),
          completedSections: job.progress?.completedSections ?? current.completedSections,
          totalSections: job.progress?.totalSections ?? current.totalSections,
          currentSection: job.progress?.currentSection ?? job.progress?.message ?? current.currentSection,
          characterCount: job.progress?.characterCount ?? current.characterCount,
          phase: job.progress?.phase ?? current.phase,
          activityCount: job.progress?.activityCount ?? current.activityCount,
        } : current);
        if (job.previewMarkdown) setData((current) => ({ ...current, generatedMarkdown: job.previewMarkdown ?? "" }));

        if (job.state === "SUCCEEDED" && job.reportId) {
          const reportResponse = await fetch(`/api/v1/projects/${id}/reports/${job.reportId}`, { headers: { "x-persona-id": CLIENT_PERSONA_ID } });
          const reportPayload = await reportResponse.json() as { data?: { id: string; createdAt: string; markdown: string; downloadUrl: string }; error?: { message?: string } };
          if (!reportResponse.ok || !reportPayload.data) throw new Error(reportPayload.error?.message || "生成结果加载失败");
          const item: SnapshotItem = { ...reportPayload.data, state: "SUCCEEDED" };
          setHistory([item]);
          setData((current) => ({ ...current, generated: { status: "SUCCEEDED", generationId, createdAt: item.createdAt }, generatedMarkdown: item.markdown }));
          setStatusMessage("隐私政策已生成，可在线预览或下载 Word");
          return;
        }
        if (job.state === "SUPERSEDED") {
          throw new Error("生成期间项目内容已更新，请按当前版本重新生成。");
        }
        if (job.state === "FAILED") {
          if (job.error?.code === "FORM_SEMANTIC_REVIEW_REQUIRED") {
            const details = job.error.details as { issues?: PreflightIssue[] } | undefined;
            const issues = (details?.issues ?? []).map((issue) => ({
              ...issue,
              fingerprint: JSON.stringify([issue.id, issue.category, [...issue.relatedPaths].sort()]),
            }));
            setPreflightIssues(issues);
          }
          const failure = failureMessages[job.error?.code ?? ""];
          throw new Error(job.error?.message || failure?.detail || "本次生成未完成，请稍后重试");
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败，可使用同一份表单重试";
      setLiveGeneration((current) => current ? {
        ...current,
        stages: current.stages.map((stage) => stage.status === "ACTIVE" ? { ...stage, status: "FAILED", message } : stage),
      } : current);
      setData((current) => ({ ...current, generated: { status: "FAILED", generationId: idempotencyKey, createdAt: new Date().toISOString(), message } }));
      setStatusMessage(message);
    }
  }

  function editPreflightIssue(issue: PreflightIssue) {
    const target: StepIndex = issue.targetStep === "profile" ? 0 : issue.targetStep === "features" || issue.targetStep === "review" ? 1 : 5;
    goToStep(target);
    setStatusMessage(issue.questionForUser);
  }

  function acknowledgePreflightIssue(issue: DisplayPreflightIssue) {
    setAcknowledgedPreflightIssues((current) => [...new Set([...current, issue.fingerprint])].slice(-20));
    setStatusMessage("已保留当前填写。该选择只对当前表单版本有效，请重新生成");
  }

  async function handleDraftAction() {
    if (data.generated?.status === "GENERATING") {
      setStatusMessage("同一份表单正在生成，请稍候");
      return;
    }
    if (!canGenerate) {
      setStatusMessage("请完成信息选择和必填补充项后再生成隐私政策草稿");
      return;
    }

    let id: string;
    try {
      id = await ensureProjectId();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "项目创建失败");
      return;
    }
    // Project revision tracks form writes, not generation attempts. A new
    // generation therefore always gets its own id even if facts did not change.
    const saved = await persistNow("generate");
    if (!saved.ok) return;
    const generationId = `web_${crypto.randomUUID()}`;
    await runDraftGeneration(id, generationId);
  }

  const draftFields = useMemo(() => selectedFieldItems.map((field) => ({ ...field, selected: fieldAnswer(field.id) === "PROCESS" })), [selectedFieldItems, data.fieldAnswers, data.confirmedFields]);
  const displayedGenerationStages = liveGeneration?.stages ?? INITIAL_GENERATION_STAGES;
  const activeGenerationStage = displayedGenerationStages.find((stage) => stage.status === "ACTIVE");
  const generationChapterProgress = liveGeneration?.totalSections
    ? Math.min(100, Math.round((liveGeneration.completedSections / liveGeneration.totalSections) * 100))
    : 0;

  const renderSupplementQuestion = (questionId: string) => {
    const question = supplementQuestions.find((item) => item.id === questionId);
    if (!question) return null;
    const answer = data.supplementAnswers[question.id];
    const slotScenario = getSlotScenario(question.id);
    const detailPresets = QUESTION_DETAIL_PRESETS[question.id] ?? [];
    const detailValues = (answer?.detail ?? "").split("；").map((item) => item.trim()).filter(Boolean);
    const detailOther = detailValues.filter((value) => !detailPresets.includes(value)).join("；");
    return <article className="supplement-question compact-question" key={question.id} data-answer={answer?.answer ?? "EMPTY"}>
      <div><strong>{question.title}</strong><p>请选择产品实际存在的情况；未选择的内容不会写入政策。</p><small>{question.help}</small></div>
      {slotScenario ? <div className="slot-workspace"><div className="slot-workspace-heading"><div><strong>{slotScenario.title}</strong></div></div><div className="slot-fields">{slotScenario.slots.map((slotItem) => {
          const slotAnswer = answer?.slots?.[slotItem.id];
          const presets = SLOT_PRESETS[slotScenario.scenarioId]?.[slotItem.id] ?? [];
          const values = (slotAnswer?.value ?? "").split("；").map((item) => item.trim()).filter(Boolean);
          const otherValue = values.filter((value) => !presets.includes(value)).join("；");
          return <section className="slot-field" data-status={slotAnswer?.status ?? "EMPTY"} key={slotItem.id}><span><strong>{slotItem.label}{slotItem.required ? " *" : ""}</strong>{slotAnswer?.status === "CANDIDATE" ? <em>待核对</em> : slotAnswer?.status === "CONFIRMED" ? <em>已填写</em> : null}</span>{presets.length ? <div className="preset-chips">{presets.map((preset) => <button type="button" key={preset} data-selected={values.includes(preset)} onClick={() => toggleSupplementSlotPreset(question.id, slotItem.id, preset, presets)}>{values.includes(preset) ? <Check weight="bold" /> : null}{preset}</button>)}</div> : null}<label><span>{presets.length ? "其他（可选）" : slotItem.prompt}</span>{slotItem.inputType === "textarea" ? <textarea value={presets.length ? otherValue : slotAnswer?.value ?? ""} onChange={(event) => presets.length ? updateSupplementSlotOther(question.id, slotItem.id, event.target.value, presets) : updateSupplementSlot(question.id, slotItem.id, event.target.value)} placeholder={presets.length ? "如有其他情况，请补充说明。" : slotItem.prompt} /> : <input type={slotItem.inputType === "url" ? "url" : "text"} value={slotAnswer?.value ?? ""} onChange={(event) => updateSupplementSlot(question.id, slotItem.id, event.target.value)} placeholder={slotItem.prompt} />}</label>{slotAnswer?.status === "CANDIDATE" ? <button type="button" onClick={() => updateSupplementSlot(question.id, slotItem.id, slotAnswer.value, "CONFIRMED", slotAnswer.evidenceText)}><Check weight="bold" /> 采用此内容</button> : null}</section>;
        })}</div><label className="supplement-detail"><span>其他整体说明（可选）</span><textarea value={answer?.detail ?? ""} onChange={(event) => updateSupplement(question.id, { answer: event.target.value.trim() || Object.keys(answer?.slots ?? {}).length ? "YES" : "NO", detail: event.target.value })} placeholder="如有其他情况，请补充说明。" /></label><button type="button" className="slot-extract-button" disabled={extractingQuestionId === question.id || !answer?.detail.trim()} onClick={() => void extractSupplementSlots(question.id)}><BracketsCurly weight="bold" /> {extractingQuestionId === question.id ? "正在整理…" : "从说明中智能整理"}</button></div> : <div className="supplement-choice-detail"><div className="preset-chips">{detailPresets.map((preset) => <button type="button" key={preset} data-selected={detailValues.includes(preset)} onClick={() => toggleQuestionDetailPreset(question.id, preset, detailPresets)}>{detailValues.includes(preset) ? <Check weight="bold" /> : null}{preset}</button>)}</div><label className="supplement-detail"><span>其他（可选）</span><textarea value={detailOther} onChange={(event) => updateQuestionDetailOther(question.id, event.target.value, detailPresets)} placeholder="如有其他情况，请补充说明。" /></label></div>}
    </article>;
  };

  return (
    <main className="workspace-page workspace-v3 w-full max-w-full">
      <header className="workspace-v3-header">
        <BaijianBrand />
        <div className="workspace-v3-header-actions">
          {saveState === "saving" ? <span className="status-pending">保存中…</span> : saveState === "saved" ? <span className="status-complete"><CheckCircle weight="fill" /> 已保存</span> : saveState === "error" ? <span className="status-error">保存失败</span> : null}
          <button type="button" className="workspace-v3-exit" onClick={handleSaveAndExit}>暂存退出</button>
        </div>
      </header>

      <div className="workspace-v3-breadcrumb">项目 <span>/</span> {data.profile.productName || "新地图项目"} <em className="category-pill">地图导航类</em></div>

      <section className="workspace-v3-progress">
        <div className="workspace-v3-progress-heading">
          <h1>{data.profile.productName ? `${data.profile.productName}隐私政策` : "地图类隐私政策"}</h1>
          <div><strong>第 {activeStep + 1} / {steps.length} 步 · {steps[activeStep]}</strong><span>完成度 {completionPercent}%</span></div>
        </div>
        <div className="workspace-v3-progress-line" aria-label={`项目完成度 ${completionPercent}%`}><span style={{ width: `${completionPercent}%` }} /></div>
        <ol className="workspace-stepper" aria-label="表单流程">
          {steps.map((step, index) => <li key={step} data-active={activeStep === index} data-complete={completedSteps[index]}><button type="button" onClick={() => goToStep(index as StepIndex)}><span className="stepper-node">{completedSteps[index] ? <Check weight="bold" /> : index + 1}</span><span className="stepper-label">{step}</span></button></li>)}
        </ol>
      </section>

      <div className="workspace-v3-content" data-assistant-open={explainerOpen}>
        <div className="workspace-v3-form">
          <div className="workspace-status" role="status" aria-live="polite">{statusMessage}</div>

          {activeStep === 0 && <BasicInformationStep data={data} complete={basicProfileComplete} onUpdate={updateProfile} onTogglePreset={toggleProfilePreset} onUpdateOther={updateProfileOther} onNext={() => void goToStep(1)} />}

          {activeStep === 1 && <ProcessingActivitiesStep data={data} selectedScenarios={selectedScenarios} selectedCustomFeatures={selectedCustomFeatures} draftFields={draftFields} customOpen={customOpen} customName={customName} canContinue={canReview} onToggleFeature={toggleFeature} onTogglePresetFeature={togglePresetFeature} onSetCustomOpen={setCustomOpen} onSetCustomName={setCustomName} onAddCustomFeature={addCustomFeature} onRemoveCustomFeature={removeCustomFeature} onToggleField={toggleField} onUpdateInformationOther={updateInformationOther} onTogglePurposePreset={togglePurposePreset} onUpdatePurposeOther={updatePurposeOther} onToggleCustomInformationPreset={toggleCustomInformationPreset} onToggleCustomPurposePreset={toggleCustomPurposePreset} onUpdateCustomPurposeOther={updateCustomPurposeOther} onUpdateNotes={(value) => commit({ additionalNotes: value }, "补充信息已保存")} onBack={() => void goToStep(0)} onNext={() => void goToStep(2)} />}

          {activeStep === 2 && <DevicePermissionsStep data={data} complete={permissionDetailsComplete} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} onTogglePermission={togglePermission} onAddCustomPermission={addCustomPermission} onUpdateCustomPermission={updateCustomPermission} onRemovePermission={removePermission} onToggleScene={togglePermissionScene} onUpdateScene={updatePermissionScene} onBack={() => void goToStep(1)} onNext={() => void goToStep(3)} />}

          {activeStep === 3 && <PartnersStep data={data} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} onConfirm={confirmPartners} onAdd={addPartner} onRemove={removePartner} onUpdate={updatePartner} onTogglePurpose={togglePartnerPurpose} onToggleListValue={togglePartnerListValue} onUpdateOtherValues={updatePartnerOtherValues} onBack={() => void goToStep(2)} onNext={() => void goToStep(4)} />}

          {activeStep === 4 && <StorageSecurityStep data={data} complete={storageDetailsComplete} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} onToggleValue={toggleStorageValue} onUpdateText={updateStorageText} onToggleSecurityMeasure={toggleSecurityMeasure} onUpdateSecurityOther={updateSecurityOther} onBack={() => void goToStep(3)} onNext={() => void confirmStorageAndContinue()} />}

          {activeStep === 5 && <RightsGenerationStep data={data} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} selectedCount={selectedCount} processedFieldCount={processedFieldCount} completedSupplementCount={completedSupplementCount} supplementCount={supplementQuestions.length} blockingDiagnostic={formalReadiness.diagnostics.filter((item) => item.severity === "BLOCKING").map((item) => item.message).join("；")} warningCount={warningCount} preflightIssues={preflightIssues} acknowledgedIssues={acknowledgedPreflightIssues} generationStages={displayedGenerationStages} activeGenerationStage={activeGenerationStage} liveGeneration={liveGeneration} generationElapsed={generationElapsed} generationChapterProgress={generationChapterProgress} history={latestSuccessfulHistory} canGenerate={canGenerate} onUpdateProfile={updateProfile} onToggleProfilePreset={toggleProfilePreset} onUpdateProfileOther={updateProfileOther} onUpdateNotes={(value) => commit({ additionalNotes: value }, "补充信息已保存")} onEditIssue={editPreflightIssue} onAcknowledgeIssue={acknowledgePreflightIssue} onDownload={downloadSnapshotDocx} onBack={() => void goToStep(4)} onGenerate={() => void handleDraftAction()} />}
        </div>

        <aside className="workspace-ai-panel" aria-label="AI 助手">
          <div className="workspace-ai-heading">
            <span><Sparkle weight="fill" /></span>
            {explainerOpen ? <strong>AI 助手</strong> : null}
            {explainerOpen && assistantMessages.length > 0 ? <button type="button" className="workspace-ai-new" onClick={clearAssistantConversation} disabled={assistantSending}>新对话</button> : null}
            <button type="button" aria-label={explainerOpen ? "收起 AI 助手" : "展开 AI 助手"} aria-expanded={explainerOpen} onClick={toggleExplainer}><CaretRight weight="bold" /></button>
          </div>
          {explainerOpen ? <div className="workspace-ai-body">
            {assistantMessages.length === 0 ? <div className="workspace-ai-empty">
              <div className="workspace-ai-empty-icon"><Sparkle weight="fill" /></div>
              <strong>我可以帮你填写当前表单</strong>
              <p>直接提问，或上传产品说明、SDK 文档和截图。我会整理为待确认内容，不会自动写入隐私政策。</p>
              <div className="workspace-ai-examples" aria-label="示例问题">
                {ASSISTANT_EXAMPLES.map((example) => <button type="button" key={example} disabled={assistantSending} onClick={() => void sendAssistantMessage(example)}><span>{example}</span><CaretRight weight="bold" /></button>)}
              </div>
            </div> : <div className="workspace-ai-messages" aria-live="polite">
              {assistantMessages.map((message) => <article key={message.id} className="workspace-ai-message" data-role={message.role}>
                {message.role === "assistant" ? <div className="workspace-ai-message-label"><span><Sparkle weight="fill" /> AI 助手</span><button type="button" aria-label="复制回答" onClick={() => void copyAssistantMessage(message.content)}><Copy weight="bold" /></button></div> : null}
                {message.role === "user" && message.attachmentNames?.length ? <div className="workspace-ai-message-files">{message.attachmentNames.map((name, index) => <span key={`${name}-${index}`}><Paperclip weight="bold" /> {name}</span>)}</div> : null}
                <p>{message.content}</p>
                {message.suggestedText ? <div className="workspace-ai-suggestion"><span>{message.suggestedText}</span><button type="button" disabled={message.applied} onClick={() => applyAssistantSuggestion(message)}>{message.applied ? "已填入表单" : "填入表单"}</button></div> : null}
              </article>)}
              {assistantSending ? <div className="workspace-ai-loading" role="status"><span /><span /><span /><em>AI 正在整理回答</em></div> : null}
              {assistantError ? <div className="workspace-ai-chat-error" role="alert"><span>{assistantError}</span><button type="button" onClick={() => void sendAssistantMessage(assistantMessages.filter((message) => message.role === "user").at(-1)?.content ?? "", false)}>重试</button></div> : null}
              <div ref={assistantEndRef} />
            </div>}
            <div className="workspace-ai-composer">
              {assistantAttachments.length > 0 ? <section className="workspace-ai-attachment-tray" data-collapsed={attachmentsCollapsed}>
                <div className="workspace-ai-attachment-heading">
                  <span>已加入资料 <b>{assistantAttachments.length}/5</b></span>
                  <button type="button" onClick={() => setAttachmentsCollapsed((collapsed) => !collapsed)}>{attachmentsCollapsed ? <><CaretRight weight="bold" /> 展开</> : <><CaretUp weight="bold" /> 收起</>}</button>
                </div>
                {!attachmentsCollapsed ? <div className="workspace-ai-attachment-list">{assistantAttachments.map((attachment) => <article key={attachment.id} className="workspace-ai-attachment" data-status={attachment.status}>
                  <span className="workspace-ai-attachment-icon"><AssistantAttachmentIcon attachment={attachment} /></span>
                  <div><strong title={attachment.name}>{attachment.name}</strong><small>{formatAttachmentSize(attachment.size)} · {attachment.status === "READING" ? "正在读取" : attachment.status === "READY" ? attachment.kind === "IMAGE" ? "已提取图片文字" : attachment.truncated ? "已读取（部分内容）" : "已读取" : attachment.error ?? "读取失败"}</small>{attachment.status === "READY" ? <button type="button" className="workspace-ai-attachment-fact-use" data-active={attachment.useForFormFilling} onClick={() => toggleAssistantAttachmentFactUse(attachment.id)}>{attachment.useForFormFilling ? "本产品资料，可用于补充" : "仅供问答参考"}</button> : null}</div>
                  {attachment.status === "READING" ? <SpinnerGap className="workspace-ai-attachment-spinner" weight="bold" /> : attachment.status === "READY" ? <i aria-label="已理解" /> : <WarningCircle className="workspace-ai-attachment-warning" weight="fill" />}
                  <button type="button" className="workspace-ai-attachment-remove" aria-label={`删除 ${attachment.name}`} onClick={() => removeAssistantAttachment(attachment.id)}><X weight="bold" /></button>
                </article>)}</div> : null}
              </section> : null}
              <div className="workspace-ai-input-shell">
                <textarea
                  rows={3}
                  value={assistantInput}
                  disabled={assistantSending}
                  placeholder="输入问题，或上传文件后提问…"
                  onChange={(event) => setAssistantInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendAssistantMessage();
                    }
                  }}
                />
                <input
                  ref={assistantFileInputRef}
                  className="workspace-ai-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => {
                    handleAssistantFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button type="button" className="workspace-ai-upload" title="上传 PDF、Word、TXT、CSV 或图片；单文件 20 MB，最多 5 个" aria-label="上传文件或图片" disabled={assistantSending || assistantAttachments.length >= 5} onClick={() => assistantFileInputRef.current?.click()}><Paperclip weight="bold" /></button>
                <button type="button" className="workspace-ai-send" aria-label="发送问题" disabled={assistantSending || assistantHasReadingAttachment || (!assistantInput.trim() && readyAssistantAttachments.length === 0)} onClick={() => void sendAssistantMessage()}><PaperPlaneTilt weight="fill" /></button>
              </div>
            </div>
          </div> : null}
        </aside>
      </div>
    </main>
  );
}
