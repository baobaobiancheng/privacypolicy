"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowClockwise,
  ArrowRight,
  BracketsCurly,
  Check,
  CheckCircle,
  CaretRight,
  DownloadSimple,
  Eye,
  FileDoc,
  Gavel,
  MapPin,
  Plus,
  ShieldCheck,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { DEV_PERSONAS } from "@/src/auth/dev-personas";
import { mapV1Content } from "@/src/content/map-v1";
import { scenarios } from "@/src/content/map-v1/ui-content";
import { MarkdownPreview } from "@/components/markdown-preview";
import { getRequiredSupplementQuestions } from "@/src/knowledge/map-cn";
import { evaluateFormalPolicyReadiness, resolveFieldAnswer, type FieldAnswer } from "@/src/knowledge/readiness";
import type { SupplementAnswer } from "@/src/knowledge/map-cn/schema";
import type { FormPayload } from "@/src/ai/deepseek";

const steps = ["适用范围", "通用信息", "功能与信息", "字段确认", "补充确认", "生成政策"];
const stepRoutes = ["scope", "profile", "features", "review", "supplement", "draft"] as const;
const profileFields = [
  ["operatorName", "运营主体全称", "例如：杭州行迹科技有限公司"],
  ["operatorContact", "运营主体联系信息", "例如：浙江省杭州市西湖区××路××号"],
  ["productName", "产品名称", "例如：行迹地图"],
  ["productVersion", "产品版本", "例如：Android 2.4"],
  ["contactEmail", "隐私联系邮箱", "例如：privacy@example.com"],
  ["rightsEntry", "用户权利请求入口", "例如：App 内「我的」-「隐私中心」"],
  ["rightsResponsePeriod", "权利请求响应方式和期限", "例如：收到申请后 15 个工作日内回复"],
  ["minorProcessing", "未成年人信息实际处理情况", "例如：不面向未成年人，发现后删除"],
  ["securityMeasures", "安全措施概述", "例如：访问控制、传输加密、最小权限"],
  ["incidentChannel", "个人信息事件通知渠道", "例如：隐私联系邮箱和 App 公告"],
  ["policyEffectiveDate", "政策生效日期", "例如：2026-08-10"],
  ["policyUpdateNotice", "政策更新通知方式", "例如：App 弹窗和隐私政策页提示"],
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;
type GeneratedState = { status: "PENDING" | "GENERATING" | "FAILED" | "SUCCEEDED"; generationId: string; message?: string; createdAt: string };
type ActivityDetail = { purpose: string; retention: string };
type DraftFormInput = {
  profile: Record<string, string>;
  selected: string[];
  customFeatures: string[];
  customDetails: Record<string, ActivityDetail>;
  activityDetails: Record<string, ActivityDetail>;
  confirmedFields: string[];
  fieldAnswers?: Record<string, FieldAnswer>;
  additionalNotes: string;
  scopeAnswers?: Record<string, boolean>;
  supplementAnswers?: Record<string, SupplementAnswer>;
};
type SnapshotItem = { id: string; state: string; createdAt: string; failureCode: string | null; inputJson: DraftFormInput | null; markdown: string | null; docxBase64: string | null };
type ProjectData = {
  projectId: string | null;
  revision: number;
  scopeAnswers: Record<string, boolean>;
  profile: Record<string, string>;
  selected: string[];
  customFeatures: string[];
  customDetails: Record<string, ActivityDetail>;
  additionalNotes: string;
  confirmedFields: string[];
  fieldAnswers: Record<string, FieldAnswer>;
  activityDetails: Record<string, ActivityDetail>;
  supplementAnswers: Record<string, SupplementAnswer>;
  scopeStop?: string;
  generated?: GeneratedState;
  generatedMarkdown?: string;
};

type PrivacyWorkspaceProps = {
  projectId?: string;
  initialStep?: StepIndex;
};

const initialProject: ProjectData = {
  projectId: null,
  revision: 0,
  scopeAnswers: {},
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
};

function projectStorageKey(projectId?: string) {
  return projectId ? `privacy-policy-project:${projectId}` : "privacy-policy-project:new";
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
};

function GenerationHistory({
  history,
  generating,
  onRetry,
  onDownload,
}: {
  history: SnapshotItem[] | null;
  generating: boolean;
  onRetry: (item: SnapshotItem) => void;
  onDownload: (item: SnapshotItem) => void;
}) {
  const [expanded, setExpanded] = useState<{ id: string; view: "markdown" | "failure" | "form" } | null>(null);
  if (history === null) return <p className="history-empty">正在加载生成记录…</p>;
  if (history.length === 0) return <p className="history-empty">还没有生成记录。完成确认后即可生成第一份隐私政策草稿。</p>;

  function toggle(id: string, view: "markdown" | "failure" | "form") {
    setExpanded((current) => current?.id === id && current.view === view ? null : { id, view });
  }

  return <div className="generation-records">{history.map((item) => {
    const succeeded = item.state === "SUCCEEDED" && Boolean(item.markdown && item.docxBase64);
    const failure = failureMessages[item.failureCode ?? ""] ?? {
      title: "草稿生成失败",
      detail: "生成过程未完成，因此没有生成 Word 文件。您可以查看本次表单后重新生成。",
    };
    const activeView = expanded?.id === item.id ? expanded.view : null;
    return <article key={item.id} className="generation-record" data-state={succeeded ? "success" : "failure"}>
      <div className="generation-record-status" aria-hidden="true">{succeeded ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}</div>
      <div className="generation-record-content">
        <div className="generation-record-heading">
          <div><strong>{succeeded ? "草稿已生成" : "政策生成失败"}</strong><span>{new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</span></div>
          <p>{succeeded ? "隐私政策草稿已生成，可在线预览、编辑或下载 Word。" : "本次未形成可用政策，填写内容已完整保存。"}</p>
        </div>
        <div className="generation-record-actions">
          {succeeded ? <>
            <button type="button" className="history-action" aria-expanded={activeView === "markdown"} onClick={() => toggle(item.id, "markdown")}><Eye weight="bold" /> 预览 Markdown</button>
            <button type="button" className="history-action history-action-primary" onClick={() => onDownload(item)}><DownloadSimple weight="bold" /> 下载 Word</button>
          </> : <>
            <button type="button" className="history-action history-action-primary" disabled={generating} onClick={() => onRetry(item)}><ArrowClockwise weight="bold" /> 重新生成</button>
            <button type="button" className="history-action" aria-expanded={activeView === "failure"} onClick={() => toggle(item.id, "failure")}><WarningCircle weight="bold" /> 查看失败原因</button>
            <button type="button" className="history-action" aria-expanded={activeView === "form"} onClick={() => toggle(item.id, "form")}><BracketsCurly weight="bold" /> 查看本次表单</button>
          </>}
        </div>
        {activeView === "markdown" && item.markdown ? <div className="generation-record-detail markdown-detail"><MarkdownPreview markdown={item.markdown} fallback={null} /></div> : null}
        {activeView === "failure" ? <div className="generation-record-detail failure-detail"><strong>{failure.title}</strong><p>{failure.detail}</p></div> : null}
        {activeView === "form" ? <div className="generation-record-detail form-detail">{item.inputJson ? <FormSnapshotSummary input={item.inputJson} /> : <p>该记录生成于表单留存功能启用前，没有保存当次填写内容。请使用当前表单重新生成。</p>}</div> : null}
      </div>
    </article>;
  })}</div>;
}

function FormSnapshotSummary({ input }: { input: DraftFormInput }) {
  const featureNames = [
    ...input.selected.map((key) => scenarios.find((scenario) => scenario.id === key)?.title ?? key),
    ...input.customFeatures,
  ];
  const activities = [
    ...input.selected.map((key) => ({ name: scenarios.find((scenario) => scenario.id === key)?.title ?? key, detail: input.activityDetails[key] })),
    ...input.customFeatures.map((name) => ({ name, detail: input.customDetails[name] })),
  ];
  return <div className="form-snapshot-summary">
    <div><strong>本次填写摘要</strong><span>以下是生成当时的内容，不会随项目后续修改而变化。</span></div>
    <dl>
      <div><dt>运营主体</dt><dd>{input.profile.operatorName || "未填写"}</dd></div>
      <div><dt>产品</dt><dd>{[input.profile.productName, input.profile.productVersion].filter(Boolean).join(" ") || "未填写"}</dd></div>
      <div><dt>已选功能</dt><dd>{featureNames.join("、") || "未选择"}</dd></div>
      <div><dt>已确认信息项</dt><dd>{input.confirmedFields.length} 项</dd></div>
    </dl>
    <div className="form-snapshot-activities">{activities.map(({ name, detail }) => <div key={name}><strong>{name}</strong><span>处理目的：{detail?.purpose || "未填写"}</span><span>保存期限：{detail?.retention || "未填写"}</span></div>)}</div>
    {input.additionalNotes ? <div className="form-snapshot-note"><strong>表单外补充</strong><p>{input.additionalNotes}</p></div> : null}
  </div>;
}

export function PrivacyWorkspace({ projectId, initialStep = 0 }: PrivacyWorkspaceProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<StepIndex>(initialStep);
  const [data, setData] = useState<ProjectData>(() => ({ ...initialProject, projectId: projectId ?? null }));
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState("所有操作会保留在当前项目表单中");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [personaId, setPersonaId] = useState<string>(DEV_PERSONAS[0].id);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [history, setHistory] = useState<SnapshotItem[] | null>(null);
  const lastSavedKeyRef = useRef<string | null>(null);

  function computeFormKey(project: Partial<ProjectData>) {
    return JSON.stringify({
      scopeAnswers: project.scopeAnswers ?? {},
      profile: project.profile ?? {},
      selected: project.selected ?? [],
      customFeatures: project.customFeatures ?? [],
      customDetails: project.customDetails ?? {},
      additionalNotes: project.additionalNotes ?? "",
      confirmedFields: project.confirmedFields ?? [],
      fieldAnswers: project.fieldAnswers ?? {},
      activityDetails: project.activityDetails ?? {},
      supplementAnswers: project.supplementAnswers ?? {},
      scopeStop: project.scopeStop,
      generatedMarkdown: project.generatedMarkdown ?? "",
    });
  }
  const formKey = computeFormKey(data);

  async function loadProjectFromServer(id: string): Promise<{ formData: Partial<ProjectData>; revision: number } | null> {
    try {
      const res = await fetch(`/api/projects/${id}`, { headers: { "x-persona-id": personaId } });
      if (!res.ok) return null;
      const payload = await res.json() as { formData: Partial<ProjectData> | null; revision: number };
      if (!payload.formData) return null;
      return { formData: payload.formData, revision: payload.revision };
    } catch {
      return null;
    }
  }

  function downloadSnapshotDocx(item: SnapshotItem) {
    if (!item.docxBase64) return;
    const binary = window.atob(item.docxBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.profile.productName || "隐私政策"}-${item.createdAt.slice(0, 10)}.docx`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const storageKey = projectStorageKey(projectId ?? data.projectId ?? undefined);
  const scopeConfirmed = mapV1Content.payload.scopeGates.every((gate) => data.scopeAnswers[gate.id] === true);
  const scopeAnswered = Object.keys(data.scopeAnswers).length > 0;
  const selectedScenarios = scenarios.filter((scenario) => data.selected.includes(scenario.id));
  const selectedCustomFeatures = data.customFeatures;
  const selectedFieldItems = selectedScenarios.flatMap((scenario) => scenario.fields.map((field, index) => ({ id: `${scenario.id}.${index}`, featureId: scenario.id, feature: scenario.title, label: field })));
  const fieldAnswer = (fieldId: string) => resolveFieldAnswer(data, fieldId);
  const processedFieldCount = selectedFieldItems.filter((field) => fieldAnswer(field.id) === "PROCESS").length;
  const resolvedFieldCount = selectedFieldItems.filter((field) => Boolean(fieldAnswer(field.id))).length;
  const selectedDetailsComplete = selectedScenarios.every((scenario) => {
    const detail = data.activityDetails[scenario.id];
    return Boolean(detail?.purpose.trim() && detail.retention.trim());
  }) && selectedCustomFeatures.every((feature) => {
    const detail = data.customDetails[feature];
    return Boolean(detail?.purpose.trim() && detail.retention.trim());
  });
  const profileComplete = profileFields.every(([key]) => Boolean(data.profile[key]?.trim()));
  const supplementQuestions = getRequiredSupplementQuestions({ selected: data.selected, customFeatures: data.customFeatures });
  const formalReadiness = evaluateFormalPolicyReadiness({
    profile: data.profile as unknown as FormPayload["profile"],
    selected: data.selected,
    customFeatures: data.customFeatures,
    customDetails: data.customDetails,
    activityDetails: data.activityDetails,
    confirmedFields: data.confirmedFields,
    fieldAnswers: data.fieldAnswers,
    additionalNotes: data.additionalNotes,
    scopeAnswers: data.scopeAnswers,
    supplementAnswers: data.supplementAnswers,
  });
  const warningCount = selectedScenarios.filter((scenario) => scenario.risk).length;
  const canReview = scopeConfirmed && profileComplete && data.selected.length > 0 && selectedDetailsComplete;
  const pendingFieldCount = selectedFieldItems.length - resolvedFieldCount;
  const canGenerate = canReview && pendingFieldCount === 0 && formalReadiness.ready;
  const selectedCount = data.selected.length + data.customFeatures.length;
  const progress = activeStep === 0 ? (scopeConfirmed ? 16 : 8) : Math.min(96, activeStep * 16 + (canGenerate ? 16 : 8));

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
        const serverData: ProjectData = {
          ...initialProject,
          ...server.formData,
          projectId,
          revision: server.revision,
          generated: undefined,
        };
        lastSavedKeyRef.current = computeFormKey(serverData);
        setData(serverData);
        const detailsComplete = scenarios
          .filter((scenario) => serverData.selected.includes(scenario.id))
          .every((scenario) => Boolean(serverData.activityDetails[scenario.id]?.purpose.trim() && serverData.activityDetails[scenario.id]?.retention.trim()))
          && serverData.customFeatures.every((feature) => Boolean(serverData.customDetails[feature]?.purpose.trim() && serverData.customDetails[feature]?.retention.trim()));
        const serverScopeConfirmed = mapV1Content.payload.scopeGates.every((gate) => serverData.scopeAnswers[gate.id] === true);
        const serverProfileComplete = profileFields.every(([key]) => Boolean(serverData.profile[key]?.trim()));
        const serverFields = scenarios.filter((scenario) => serverData.selected.includes(scenario.id)).flatMap((scenario) => scenario.fields.map((_, index) => `${scenario.id}.${index}`));
        const serverFieldsConfirmed = serverFields.every((field) => Boolean(resolveFieldAnswer(serverData, field)));
        const serverReadiness = evaluateFormalPolicyReadiness({ profile: serverData.profile as unknown as FormPayload["profile"], selected: serverData.selected, customFeatures: serverData.customFeatures, customDetails: serverData.customDetails, activityDetails: serverData.activityDetails, confirmedFields: serverData.confirmedFields, additionalNotes: serverData.additionalNotes, scopeAnswers: serverData.scopeAnswers, supplementAnswers: serverData.supplementAnswers });
        const firstIncomplete: StepIndex = !serverScopeConfirmed ? 0 : !serverProfileComplete ? 1 : !serverData.selected.length || !detailsComplete ? 2 : !serverFieldsConfirmed ? 3 : !serverReadiness.ready ? 4 : 5;
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
        const parsed = JSON.parse(saved) as Partial<ProjectData>;
        setData({
          ...initialProject,
          ...parsed,
          projectId: parsed.projectId ?? null,
          scopeAnswers: parsed.scopeAnswers ?? {},
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
        });
      } catch {
        setStatusMessage("本地项目表单无法读取，已创建空白填写页");
      }
    }
    setHydrated(true);

    return () => {
      cancelled = true;
    };
  }, [projectId, storageKey, personaId]);

  useEffect(() => {
    setActiveStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    if (!hydrated) return;
    const firstIncomplete: StepIndex = !scopeConfirmed ? 0 : !profileComplete ? 1 : !data.selected.length || !selectedDetailsComplete ? 2 : pendingFieldCount > 0 ? 3 : !formalReadiness.ready ? 4 : 5;
    if (initialStep > firstIncomplete) setActiveStep(firstIncomplete);
  }, [data.selected.length, hydrated, initialStep, profileComplete, scopeConfirmed, selectedDetailsComplete, pendingFieldCount, formalReadiness.ready]);

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  // 防抖保存到 MySQL；revision 作为乐观锁，冲突时重新载入。
  useEffect(() => {
    if (!hydrated || !data.projectId || !formKey) return;
    if (lastSavedKeyRef.current === formKey) return;
    const projectId = data.projectId;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-persona-id": personaId },
          body: JSON.stringify({ expectedRevision: data.revision, formData: data }),
        });
        if (res.status === 409) {
          setStatusMessage("项目已在其他页面更新，已重新载入最新版本");
          const server = await loadProjectFromServer(projectId);
          if (server) {
            lastSavedKeyRef.current = computeFormKey(server.formData);
            setData({ ...initialProject, ...server.formData, projectId, revision: server.revision, generated: undefined });
          }
          return;
        }
        if (!res.ok) throw new Error("保存失败");
        const payload = await res.json() as { revision: number };
        lastSavedKeyRef.current = formKey;
        setData((current) => ({ ...current, revision: payload.revision }));
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setStatusMessage("保存到服务器失败，请检查 MySQL 是否可用");
      }
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, hydrated, data.projectId, data.revision, personaId]);

  // 最后一步加载生成历史记录。
  useEffect(() => {
    if (activeStep !== 5 || !data.projectId) return;
    fetch(`/api/projects/${data.projectId}/snapshots`, { headers: { "x-persona-id": personaId } })
      .then(async (res) => {
        if (!res.ok) return { snapshots: [] };
        return (await res.json()) as { snapshots: SnapshotItem[] };
      })
      .then((payload) => setHistory(payload.snapshots))
      .catch(() => setHistory([]));
  }, [activeStep, data.projectId, personaId, data.generated?.status]);

  function commit(next: Partial<ProjectData>, message = "已保存") {
    const touchesGenerated = "generated" in next;
    setData((current) => {
      // 非生成动作（用户修改表单）必须失效已生成的草稿，避免下载/预览与当前确认事实不一致的旧文档。
      const changes = touchesGenerated ? next : { ...next, generated: undefined, generatedMarkdown: "" };
      return { ...current, ...changes };
    });
    if (!touchesGenerated) setDownloadUrl(null);
    setStatusMessage(message);
  }

  async function ensureProjectId(): Promise<string> {
    if (data.projectId) return data.projectId;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-persona-id": personaId },
      body: JSON.stringify({ formData: data }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { message?: string } | null;
      throw new Error(payload?.message || "项目创建失败，请检查数据库连接");
    }
    const payload = await res.json() as { projectId: string; revision: number };
    lastSavedKeyRef.current = formKey;
    setData((current) => ({ ...current, projectId: payload.projectId, revision: payload.revision }));
    return payload.projectId;
  }

  function goToStep(step: StepIndex) {
    if (step > 0 && !scopeConfirmed) {
      setStatusMessage("请先完成四项范围门禁");
      setActiveStep(0);
      return;
    }
    if (step > 1 && !profileComplete) {
      setStatusMessage("请先完成通用披露信息");
      setActiveStep(1);
      return;
    }
    if (step > 2 && (!data.selected.length || !selectedDetailsComplete)) {
      setStatusMessage("请为每个已选功能填写处理目的和保存期限");
      setActiveStep(2);
      return;
    }
    if (step > 3 && pendingFieldCount > 0) {
      setStatusMessage("请先逐项确认产品实际处理的信息");
      setActiveStep(3);
      return;
    }
    if (step > 4 && !formalReadiness.ready) {
      setStatusMessage("请先完成动态补充确认中的阻断项");
      setActiveStep(4);
      return;
    }
    setActiveStep(step);
    if (data.projectId) router.push(`/projects/${data.projectId}/${stepRoutes[step]}`);
  }

  function updateScope(gateId: string) {
    commit({ scopeAnswers: { ...data.scopeAnswers, [gateId]: !data.scopeAnswers[gateId] } }, "范围答案已保存");
  }

  async function handleScopeContinue() {
    if (!scopeConfirmed) {
      setStatusMessage("四项范围门禁全部确认后才能继续");
      return;
    }
    try {
      const id = await ensureProjectId();
      setActiveStep(1);
      router.push(`/projects/${id}/profile`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "项目创建失败");
    }
  }

  async function handleScopeStop() {
    if (!scopeAnswered) {
      setStatusMessage("请至少回答一项范围问题，再保存并退出");
      return;
    }
    try {
      const id = await ensureProjectId();
      commit({ scopeStop: "SCOPE_STOP", projectId: id }, "已保存范围停止原因；该项目暂不适用地图类试点");
      router.push("/projects");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "项目创建失败");
    }
  }

  async function handleSaveAndExit() {
    if (!data.projectId && !scopeAnswered) {
      setStatusMessage("尚未提交任何范围答案，未创建空项目");
      router.push("/");
      return;
    }
    try {
      await ensureProjectId();
      setStatusMessage("已保存，正在返回项目列表");
      router.push("/projects");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "项目创建失败");
    }
  }

  function updateProfile(field: string, value: string) {
    commit({ profile: { ...data.profile, [field]: value } }, "通用信息已保存");
  }

  function toggleFeature(id: string) {
    const selected = data.selected.includes(id) ? data.selected.filter((item) => item !== id) : [...data.selected, id];
    const details = { ...data.activityDetails };
    if (!selected.includes(id)) delete details[id];
    commit({ selected, activityDetails: details, confirmedFields: data.confirmedFields.filter((field) => !field.startsWith(`${id}.`)), fieldAnswers: Object.fromEntries(Object.entries(data.fieldAnswers).filter(([field]) => !field.startsWith(`${id}.`))) }, "功能选择已保存");
  }

  function updateActivityDetail(id: string, field: keyof ActivityDetail, value: string) {
    const current = data.activityDetails[id] ?? { purpose: "", retention: "" };
    commit({ activityDetails: { ...data.activityDetails, [id]: { ...current, [field]: value } } }, "处理活动详情已保存");
  }

  function addCustomFeature() {
    const normalized = customName.trim();
    if (!normalized) {
      setStatusMessage("请填写自定义功能名称");
      return;
    }
    commit({ customFeatures: [...data.customFeatures, normalized], customDetails: { ...data.customDetails, [normalized]: { purpose: "", retention: "" } } }, "自定义功能已保存");
    setCustomName("");
    setCustomOpen(false);
  }

  function setFieldAnswer(fieldId: string, answer: FieldAnswer) {
    const confirmedFields = answer === "PROCESS" ? [...new Set([...data.confirmedFields, fieldId])] : data.confirmedFields.filter((item) => item !== fieldId);
    commit({ fieldAnswers: { ...data.fieldAnswers, [fieldId]: answer }, confirmedFields }, "字段处理结论已保存");
  }

  function updateSupplement(questionId: string, patch: Partial<SupplementAnswer>) {
    const current = data.supplementAnswers[questionId] ?? { answer: "UNKNOWN" as const, detail: "" };
    commit({ supplementAnswers: { ...data.supplementAnswers, [questionId]: { ...current, ...patch, updatedAt: new Date().toISOString() } } }, "补充确认已保存");
  }

  async function runDraftGeneration(id: string, generationId: string, input: DraftFormInput) {
    commit({ generated: { status: "GENERATING", generationId, createdAt: new Date().toISOString() } }, "正在整理已确认信息并生成隐私政策草稿");
    try {
      const response = await fetch("/api/draft/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-persona-id": personaId },
        body: JSON.stringify({ projectId: id, expectedRevision: data.revision, generationId, ...input }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null) as { message?: string; code?: string } | null;
        const publicFailure = failureMessages[errorPayload?.code ?? ""];
        throw new Error(publicFailure?.title || "本次生成未完成，请稍后重试");
      }
      const payload = await response.json() as { markdown?: string; docxBase64?: string };
      if (!payload.markdown || !payload.docxBase64) throw new Error("生成结果不完整，请重新生成");
      const binary = window.atob(payload.docxBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      setDownloadUrl(URL.createObjectURL(blob));
      setData((current) => ({ ...current, generated: { status: "SUCCEEDED", generationId, createdAt: new Date().toISOString() }, generatedMarkdown: payload.markdown }));
      setStatusMessage("隐私政策草稿已生成，可在线预览或下载 Word");
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败，可使用同一份表单重试";
      setData((current) => ({ ...current, generated: { status: "FAILED", generationId, createdAt: new Date().toISOString(), message } }));
      setStatusMessage(message);
    }
  }

  function retrySnapshot(item: SnapshotItem) {
    if (!data.projectId) {
      setStatusMessage("项目尚未创建，无法重新生成");
      return;
    }
    const input = item.inputJson ?? {
      profile: data.profile,
      selected: data.selected,
      activityDetails: data.activityDetails,
      customFeatures: data.customFeatures,
      customDetails: data.customDetails,
      confirmedFields: data.confirmedFields,
      fieldAnswers: data.fieldAnswers,
      additionalNotes: data.additionalNotes,
      scopeAnswers: data.scopeAnswers,
      supplementAnswers: data.supplementAnswers,
    };
    if (!item.inputJson) setStatusMessage("旧记录没有输入副本，将使用当前项目表单重新生成");
    const generationId = `${data.projectId}-r${Date.now().toString(36)}`;
    void runDraftGeneration(data.projectId, generationId, input);
  }

  async function handleDraftAction() {
    if (data.generated?.status === "GENERATING") {
      setStatusMessage("同一份表单正在生成，请稍候");
      return;
    }
    if (data.generated?.status === "SUCCEEDED" && downloadUrl) {
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${data.profile.productName || "隐私政策"}-隐私政策草稿.docx`;
      anchor.click();
      return;
    }
    if (!canGenerate) {
      setStatusMessage("请完成字段确认和动态补充问卷后再生成隐私政策草稿");
      return;
    }

    let id: string;
    try {
      id = await ensureProjectId();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "项目创建失败");
      return;
    }
    const generationId = `${id}-g${data.revision + 1}`;
    await runDraftGeneration(id, generationId, {
      profile: data.profile,
      selected: data.selected,
      activityDetails: data.activityDetails,
      customFeatures: data.customFeatures,
      customDetails: data.customDetails,
      confirmedFields: data.confirmedFields,
      fieldAnswers: data.fieldAnswers,
      additionalNotes: data.additionalNotes,
      scopeAnswers: data.scopeAnswers,
      supplementAnswers: data.supplementAnswers,
    });
  }

  const draftFields = useMemo(() => selectedFieldItems.map((field) => ({ ...field, answer: fieldAnswer(field.id) })), [selectedFieldItems, data.fieldAnswers, data.confirmedFields]);

  return (
    <main className="workspace-page workspace-section w-full max-w-full overflow-x-hidden bg-paper-light text-ink">
      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <div className="workspace-project"><span className="project-icon"><MapPin weight="fill" /></span><div><strong>{data.profile.productName || "新地图项目"}</strong><span>客户法务填写 · 产品与技术补充</span></div></div>
          <ol className="step-list">
            {steps.map((step, index) => <li key={step}><button type="button" data-active={activeStep === index} data-complete={index < activeStep} onClick={() => goToStep(index as StepIndex)}><span>{index < activeStep ? <Check weight="bold" /> : index + 1}</span>{step}</button></li>)}
          </ol>
          <div className="workspace-help"><ShieldCheck weight="duotone" /><span>系统不会输出“已合规”结论</span></div>
        </aside>

        <div className="workspace-main">
          <div className="workspace-toolbar">
            <div><span>项目完成度</span><strong>{progress}%</strong></div>
            <div className="progress-line"><span style={{ width: `${progress}%` }} /></div>
            <div className="workspace-toolbar-actions"><label><span className="sr-only">开发身份</span><select value={personaId} onChange={(event) => { setPersonaId(event.target.value); setStatusMessage("开发身份已切换（仅本地演示）"); }} aria-label="开发身份"><option value={DEV_PERSONAS[0].id}>客户法务</option><option value={DEV_PERSONAS[1].id}>产品与技术</option></select></label>{saveState === "saving" ? <span className="status-pending">保存中…</span> : saveState === "saved" ? <span className="status-complete">已保存到服务器</span> : null}<button type="button" onClick={handleSaveAndExit}>保存并退出</button></div>
          </div>
          <div className="workspace-status" role="status" aria-live="polite">{statusMessage}</div>

          {activeStep === 0 && <section className="workspace-panel panel-enter"><div className="panel-heading"><p>确认适用范围</p><h2>这个项目是否适合地图类首期试点？</h2><span>四项都满足后才进入地图类工作区；回答不会被 AI 自动补齐。</span></div><div className="scope-list">{mapV1Content.payload.scopeGates.map((gate) => <label key={gate.id} className="scope-item"><input type="checkbox" checked={data.scopeAnswers[gate.id] === true} onChange={() => updateScope(gate.id)} /><span className="custom-checkbox"><Check weight="bold" /></span><span>{gate.label}</span></label>)}</div><div className="rule-callout"><Gavel weight="duotone" /><div><strong>地图类必要信息规则</strong><span>基本功能：定位和导航；必要信息：位置信息、出发地、到达地。</span></div><a href="https://www.gov.cn/zhengce/zhengceku/2021-03/23/content_5595088.htm" target="_blank" rel="noreferrer">查看原文</a></div><div className="panel-actions"><button type="button" className="button button-ghost" onClick={handleScopeStop}>暂存并退出</button><button type="button" className="button button-primary" disabled={!scopeConfirmed} onClick={handleScopeContinue}>确认并继续 <ArrowRight weight="bold" /></button></div></section>}

          {activeStep === 1 && <section className="workspace-panel panel-enter"><div className="panel-heading"><p>通用披露信息</p><h2>先把政策的主体和适用范围说清楚。</h2><span>以下内容来自客户填写，不会由模板自动补齐。</span></div><div className="form-grid">{profileFields.map(([key, label, placeholder]) => <label key={key} className={key === "rightsEntry" ? "full-field" : ""}><span>{label}</span><input value={data.profile[key] ?? ""} onChange={(event) => updateProfile(key, event.target.value)} placeholder={placeholder} /></label>)}</div><div className="panel-actions"><button type="button" className="button button-ghost" onClick={() => goToStep(0)}><ArrowLeft weight="bold" /> 返回</button><button type="button" className="button button-primary" disabled={!profileComplete} onClick={() => goToStep(2)}>保存并选择功能 <ArrowRight weight="bold" /></button></div></section>}

          {activeStep === 2 && <section className="workspace-panel panel-enter">
            <div className="panel-heading"><p>功能与信息</p><h2>确认产品实际提供的功能。</h2><span>候选项默认不选；选中后必须填写处理活动目的和保存期限。</span></div>
            <div className="workspace-feature-list">{scenarios.map((scenario) => { const checked = data.selected.includes(scenario.id); return <button key={scenario.id} type="button" className="workspace-feature-card group" data-selected={checked} onClick={() => toggleFeature(scenario.id)}><span className="feature-check">{checked && <Check weight="bold" />}</span><span><strong>{scenario.title}</strong><small>{scenario.group}</small></span><span className="feature-source">{scenario.source}</span><CaretRight weight="bold" /></button>; })}{data.customFeatures.map((feature) => <div key={feature} className="workspace-feature-card" data-selected="true"><span className="feature-check"><Check weight="bold" /></span><span><strong>{feature}</strong><small>客户自定义功能</small></span><span className="feature-source">客户填写</span><button type="button" className="remove-feature" onClick={() => commit({ customFeatures: data.customFeatures.filter((item) => item !== feature), customDetails: Object.fromEntries(Object.entries(data.customDetails).filter(([key]) => key !== feature)) }, "自定义功能已删除")} aria-label={`删除${feature}`}><X weight="bold" /></button></div>)}</div>
            {customOpen ? <div className="custom-form"><input autoFocus value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="例如：收藏常用地点" onKeyDown={(event) => event.key === "Enter" && addCustomFeature()} /><button type="button" onClick={addCustomFeature}>添加</button><button type="button" onClick={() => setCustomOpen(false)}>取消</button></div> : <button type="button" className="add-feature" onClick={() => setCustomOpen(true)}><Plus weight="bold" /> 添加表单中没有的功能</button>}
            <label className="additional-notes"><span>表单外补充信息（可选）</span><small>把表单没有覆盖、但产品实际存在的功能、SDK、第三方或处理规则写在这里。模型只会将其作为客户原文，不会自动变成未经确认的事实。</small><textarea value={data.additionalNotes} onChange={(event) => commit({ additionalNotes: event.target.value }, "补充信息已保存")} placeholder="例如：使用定位 SDK，仅在用户点击开始导航后获取前台定位；不做后台持续定位。" /></label>
            {(selectedScenarios.length > 0 || selectedCustomFeatures.length > 0) && <div className="activity-details"><div className="field-confirm-heading"><strong>处理活动详情</strong><span>这些内容必须来自客户实际产品，不能由参考政策代填。</span></div>{selectedScenarios.map((scenario) => <div className="activity-detail-card" key={scenario.id}><div><strong>{scenario.title}</strong><small>{scenario.fields.join("、")}</small></div><label><span>实际处理目的</span><input value={data.activityDetails[scenario.id]?.purpose ?? ""} onChange={(event) => updateActivityDetail(scenario.id, "purpose", event.target.value)} placeholder="例如：提供路线规划" /></label><label><span>保存期限规则</span><input value={data.activityDetails[scenario.id]?.retention ?? ""} onChange={(event) => updateActivityDetail(scenario.id, "retention", event.target.value)} placeholder="例如：导航结束后删除或去标识化" /></label></div>)}{selectedCustomFeatures.map((feature) => <div className="activity-detail-card" key={feature}><div><strong>{feature}</strong><small>客户自定义功能 · 至少填写实际目的和保存期限</small></div><label><span>实际处理目的</span><input value={data.customDetails[feature]?.purpose ?? ""} onChange={(event) => commit({ customDetails: { ...data.customDetails, [feature]: { purpose: event.target.value, retention: data.customDetails[feature]?.retention ?? "" } } }, "自定义功能目的已保存")} placeholder="例如：收藏常用地点" /></label><label><span>保存期限规则</span><input value={data.customDetails[feature]?.retention ?? ""} onChange={(event) => commit({ customDetails: { ...data.customDetails, [feature]: { purpose: data.customDetails[feature]?.purpose ?? "", retention: event.target.value } } }, "自定义功能保存期限已保存")} placeholder="例如：用户删除后清除" /></label></div>)}</div>}
            <div className="panel-actions"><button type="button" className="button button-ghost" onClick={() => goToStep(1)}><ArrowLeft weight="bold" /> 返回</button><button type="button" className="button button-primary" disabled={!selectedCount || !selectedDetailsComplete} onClick={() => goToStep(3)}>进入字段确认 <ArrowRight weight="bold" /></button></div>
          </section>}

          {activeStep === 3 && <section className="workspace-panel panel-enter">
            <div className="panel-heading"><p>处理活动总览</p><h2>确认产品事实，再生成隐私政策草稿。</h2><span>客户法务确认事实，产品与技术人员协助核实实际处理行为。</span></div>
            <div className="review-summary-grid"><div><span>已选功能</span><strong>{selectedCount}</strong></div><div><span>已完成结论</span><strong>{resolvedFieldCount} / {selectedFieldItems.length}</strong></div><div><span>实际处理信息</span><strong>{processedFieldCount}</strong></div><div data-warning={warningCount > 0}><span>重点核对</span><strong>{warningCount}</strong></div></div>
            <div className="field-confirm-list" aria-label="字段级事实确认"><div className="field-confirm-heading"><strong>字段级事实确认</strong><span>请对每项候选信息明确选择“处理”或“不处理”。未处理的信息不会写入草稿。</span></div>{draftFields.map((field) => <div key={field.id} className="field-confirm-item" data-answer={field.answer ?? "UNANSWERED"}><span><strong>{field.label}</strong><small>{field.feature}</small></span><div className="field-answer-actions"><button type="button" className={field.answer === "PROCESS" ? "selected" : ""} onClick={() => setFieldAnswer(field.id, "PROCESS")}>处理</button><button type="button" className={field.answer === "NOT_PROCESS" ? "selected" : ""} onClick={() => setFieldAnswer(field.id, "NOT_PROCESS")}>不处理</button></div></div>)}</div>
            <div className="review-table" role="table" aria-label="处理活动总览"><div className="review-row review-head" role="row"><span>处理活动</span><span>来源</span><span>状态</span></div>{selectedScenarios.map((item) => { const fields = selectedFieldItems.filter((field) => field.featureId === item.id); const complete = fields.length > 0 && fields.every((field) => Boolean(fieldAnswer(field.id))); return <div className="review-row" role="row" key={item.id}><span><strong>{item.title}</strong><small>{item.fields.join("、")}</small></span><span>{item.source}</span><span className={item.risk ? "status-warning" : complete ? "status-complete" : "status-pending"}>{item.risk ? "重点核对" : complete ? "已完成确认" : "待客户确认"}</span></div>; })}{selectedCustomFeatures.map((item) => <div className="review-row" role="row" key={item}><span><strong>{item}</strong><small>客户自定义功能</small></span><span>客户填写</span><span className={data.customDetails[item]?.purpose && data.customDetails[item]?.retention ? "status-complete" : "status-pending"}>{data.customDetails[item]?.purpose && data.customDetails[item]?.retention ? "客户已确认" : "待客户确认"}</span></div>)}</div>
            {warningCount > 0 && <div className="warning-callout"><Warning weight="fill" /><div><strong>存在重点核对项</strong><span>请由客户法务与产品、技术人员共同确认实际处理方式；系统不会自动作出法律结论。</span></div></div>}
            <div className="panel-actions"><button type="button" className="button button-ghost" onClick={() => goToStep(2)}><ArrowLeft weight="bold" /> 返回修改</button><button type="button" className="button button-primary" disabled={!canReview || pendingFieldCount > 0} onClick={() => goToStep(4)}>进入补充确认 <ArrowRight weight="bold" /></button></div>
          </section>}

          {activeStep === 4 && <section className="workspace-panel panel-enter">
            <div className="panel-heading"><p>动态补充确认</p><h2>根据已选功能补齐容易遗漏的事实。</h2><span>问题来自本地审核的地图类规则和行业场景，不展示或引用任何参考产品。选择“有”时请说明实际情况；“不确定”会提示产品或技术负责人确认。</span></div>
            <div className="supplement-question-list">
              {supplementQuestions.map((question) => {
                const answer = data.supplementAnswers[question.id];
                return <article className="supplement-question" key={question.id} data-answer={answer?.answer ?? "EMPTY"}>
                  <div><strong>{question.title}</strong><p>{question.prompt}</p><small>{question.help}</small></div>
                  <div className="supplement-answer-options" role="group" aria-label={question.title}>
                    {(["YES", "NO", "UNKNOWN"] as const).map((value) => <button key={value} type="button" className={answer?.answer === value ? "selected" : ""} onClick={() => updateSupplement(question.id, { answer: value, detail: value === "YES" ? answer?.detail ?? "" : "" })}>{value === "YES" ? "有" : value === "NO" ? "没有" : "不确定"}</button>)}
                  </div>
                  {answer?.answer === "YES" ? <label className="supplement-detail"><span>{question.yesDetailLabel}</span><textarea value={answer.detail} onChange={(event) => updateSupplement(question.id, { detail: event.target.value })} placeholder="仅填写本产品的实际配置和处理方式" /></label> : null}
                  {answer?.answer === "UNKNOWN" ? <p className="supplement-unknown"><WarningCircle weight="fill" /> {question.unknownMessage}</p> : null}
                </article>;
              })}
            </div>
            <label className="additional-notes"><span>其他补充说明（可选）</span><small>可补充以上问题未覆盖的实际处理情况。内容会以客户原文送入生成流程，不会被自动改写成未经确认的事实。</small><textarea value={data.additionalNotes} onChange={(event) => commit({ additionalNotes: event.target.value }, "补充说明已保存")} placeholder="例如：用户主动开启云端同步后，才同步收藏地点；用户可在设置中关闭。" /></label>
            {formalReadiness.diagnostics.length > 0 ? <div className="warning-callout"><Warning weight="fill" /><div><strong>生成前还有待完成事项</strong><span>{formalReadiness.diagnostics.filter((item) => item.severity === "BLOCKING").map((item) => item.message).join("；") || "已完成客户侧事实确认。"}</span></div></div> : null}
            <div className="panel-actions"><button type="button" className="button button-ghost" onClick={() => goToStep(3)}><ArrowLeft weight="bold" /> 返回字段确认</button><button type="button" className="button button-primary" disabled={!formalReadiness.ready} onClick={() => goToStep(5)}>进入政策生成 <ArrowRight weight="bold" /></button></div>
          </section>}

          {activeStep === 5 && <section className="workspace-panel draft-panel panel-enter">
            <div className="panel-heading">
              <p>隐私政策草稿</p>
              <h2>{data.generated?.status === "SUCCEEDED" ? "草稿已生成，可直接预览、编辑或下载。" : data.generated?.status === "GENERATING" ? "正在生成隐私政策草稿。" : data.generated?.status === "FAILED" ? "本次生成未完成，填写内容已保存。" : "确认事实后，生成隐私政策草稿。"}</h2>
              <span>{data.generated?.status === "FAILED" ? "可在生成记录中查看原因和当次填写内容，然后直接重新生成。" : "系统仅使用客户法务和产品、技术人员确认的事实生成草稿，不作合规结论。"}</span>
            </div>
            <div className="generation-process" aria-label="隐私政策草稿生成流程">
              <div><span>1</span><strong>整理填写内容</strong><small>汇总通用信息、功能、信息项和表单外补充。</small></div>
              <div><span>2</span><strong>生成正式政策文本</strong><small>按隐私政策结构组织内容，不擅自补写客户事实。</small></div>
              <div><span>3</span><strong>校验后提供草稿文件</strong><small>只有章节完整、事实边界清晰的文本才能预览和下载。</small></div>
            </div>
            <div className="draft-preview"><div className="draft-page"><span className="draft-watermark">隐私政策草稿</span><MarkdownPreview markdown={data.generatedMarkdown} fallback={<><h3>{data.profile.productName} 隐私政策</h3><p>完成事实确认后，系统会在这里展示可编辑的隐私政策草稿。</p><h4>生成范围</h4><p>已确认 {selectedCount} 项产品功能和 {processedFieldCount} 项实际处理的个人信息。</p></>} /><p className="draft-footnote">{processedFieldCount} 项实际处理信息 · {supplementQuestions.length} 项补充事实已核对</p></div><aside className="draft-audit"><FileDoc weight="duotone" /><strong>{data.generated?.status === "GENERATING" ? "正在生成草稿" : "草稿预览"}</strong><span>{selectedCount} 项产品功能</span><span>{processedFieldCount} 项实际处理信息</span><span>{supplementQuestions.length} 项补充确认</span><span>{warningCount} 项重点核对提示</span></aside></div>
            {data.projectId && <div className="draft-history"><div className="field-confirm-heading"><strong>生成记录</strong><span>每次生成都会保存，成功版本可随时预览和重新下载。</span></div><GenerationHistory history={history} generating={data.generated?.status === "GENERATING"} onRetry={retrySnapshot} onDownload={downloadSnapshotDocx} /></div>}
            <div className="panel-actions"><button type="button" className="button button-ghost" onClick={() => goToStep(4)}><ArrowLeft weight="bold" /> 返回补充确认</button><button type="button" className="button button-primary" disabled={data.generated?.status === "GENERATING" || (!canGenerate && data.generated?.status !== "SUCCEEDED")} onClick={handleDraftAction}>{data.generated?.status === "SUCCEEDED" ? <><DownloadSimple weight="bold" /> 下载 Word 草稿</> : <><FileDoc weight="bold" /> {data.generated?.status === "GENERATING" ? "正在生成…" : data.generated?.status === "FAILED" ? "重新生成" : "生成隐私政策草稿"}</>}</button></div>
          </section>}
        </div>
      </div>
    </main>
  );
}
