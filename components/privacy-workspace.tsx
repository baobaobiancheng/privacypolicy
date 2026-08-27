"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { BaijianBrand } from "@/components/baijian-brand";
import type { PreflightIssue } from "@/src/ai/deepseek";
import { createBrowserId } from "@/src/browser/random-id";
import { WORKSPACE_STEPS, workspaceSlugFor } from "@/src/workspace/contract";
import { canonicalizeProjectFormData, toWorkspaceCompatibilityState } from "@/src/workspace/form-adapter";
import {
  createDevelopmentProjectDefaults,
  developmentFormDefaultsEnabled,
} from "@/src/workspace/development-defaults";
import { BasicInformationStep } from "@/components/workspace/steps/basic-information-step";
import { AssistantPanel } from "@/components/workspace/assistant-panel";
import { useWorkspaceFormActions } from "@/components/workspace/workspace-form-actions";
import { useGenerationRunner } from "@/components/workspace/use-generation-runner";
import { useWorkspaceAssistant } from "@/components/workspace/use-workspace-assistant";
import { useWorkspaceDerivedState } from "@/components/workspace/use-workspace-derived-state";
import { firstIncompleteFor, toProjectFormData } from "@/components/workspace/workspace-project-mapper";
import { useProjectPersistence } from "@/components/workspace/use-project-persistence";
import { SupplementQuestion } from "@/components/workspace/supplement-question";
import { downloadReport } from "@/components/workspace/download-report";
import {
  DevicePermissionsStep,
  GenerationStep,
  PartnersStep,
  ProcessingActivitiesStep,
  RightsStep,
  StorageSecurityStep,
} from "@/components/workspace/lazy-workspace-steps";
import { clearProjectCreationKey, projectCreationStorage, resolveProjectCreationKey } from "@/src/workspace/project-creation-key";
import { usageConfirmationRequest } from "@/src/workspace/usage-confirmation";
import {
  CLIENT_PERSONA_ID,
  INITIAL_GENERATION_STAGES,
  type DisplayPreflightIssue,
  type GenerationJobPayload,
  type ProjectData,
  type SnapshotItem,
  type StepIndex,
} from "@/components/workspace/workspace-model";

const steps = WORKSPACE_STEPS.map((item) => item.label);

type PrivacyWorkspaceProps = {
  projectId?: string;
  initialStep?: StepIndex;
};

const emptyProject: ProjectData = {
  projectId: null,
  categoryKey: "map-navigation",
  categoryLabel: "地图导航",
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
function projectStorageKey(projectId?: string) {
  if (projectId) return `privacy-policy-project:${projectId}`;
  return developmentPrefillEnabled ? "privacy-policy-project:new:dev-prefill-v4" : "privacy-policy-project:new";
}

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
  const creationKeyRef = useRef<string | null>(null);
  const autoGenerationAfterReviewRef = useRef<string | null>(null);
  const changeVersionRef = useRef(0);
  const [localChangeVersion, setLocalChangeVersion] = useState(0);
  const dataRef = useRef<ProjectData>(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const persistence = useProjectPersistence({ dataRef, changeVersionRef, setData, setStatusMessage, setSaveState });
  const { liveGeneration, generationElapsed, run: runDraftGeneration, resume: resumeDraftGeneration } = useGenerationRunner({
    generatedStatus: data.generated,
    commit,
    setData,
    setHistory,
    setStatusMessage,
    setPreflightIssues,
  });

  async function loadProjectFromServer(id: string): Promise<{ formData: Partial<ProjectData>; revision: number; categoryKey: string; categoryLabel: string; currentStepKey: string; latestGeneration: GenerationJobPayload | null } | null> {
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { headers: { "x-persona-id": CLIENT_PERSONA_ID } });
      if (!res.ok) return null;
      const payload = await res.json() as { data: { formData: unknown; revision: number; categoryKey: string; categoryLabel: string; currentStepKey: string; latestGeneration: GenerationJobPayload | null } };
      const canonical = canonicalizeProjectFormData(payload.data.formData);
      return { formData: toWorkspaceCompatibilityState(canonical, payload.data.categoryKey), revision: payload.data.revision, categoryKey: payload.data.categoryKey, categoryLabel: payload.data.categoryLabel, currentStepKey: payload.data.currentStepKey, latestGeneration: payload.data.latestGeneration };
    } catch {
      return null;
    }
  }

  const storageKey = projectStorageKey(projectId ?? data.projectId ?? undefined);

  const {
    questionnaire,
    scenarios,
    basicFeatureIds,
    selectedScenarios,
    selectedCustomFeatures,
    selectedFieldItems,
    fieldAnswer,
    processedFieldCount,
    selectedDetailsComplete,
    basicProfileComplete,
    supplementQuestions,
    completedSupplementCount,
    formalReadiness,
    canReview,
    permissionDetailsComplete,
    storageDetailsComplete,
    canGenerate,
    firstIncompleteStep,
    latestSuccessfulHistory,
    selectedCount,
    completedSteps,
    completionPercent,
    assistantPrompt,
    assistantStepFields,
    assistantProjectFacts,
  } = useWorkspaceDerivedState(data, activeStep, history);
  const assistant = useWorkspaceAssistant({
    projectId: data.projectId,
    data,
    dataRef,
    currentStep: `${steps[activeStep]}：${assistantPrompt}`,
    currentStepFields: assistantStepFields,
    projectFacts: assistantProjectFacts,
    selectedFeatures: [
      ...selectedScenarios.map((scenario) => ({ name: scenario.title, purpose: data.activityDetails[scenario.id]?.purpose ?? "" })),
      ...selectedCustomFeatures.map((name) => ({ name, purpose: data.customDetails[name]?.purpose ?? "" })),
    ],
    processedInformation: selectedFieldItems.filter((field) => fieldAnswer(field.id) === "PROCESS").map((field) => `${field.feature}：${field.label}`),
    commit,
    setStatusMessage,
  });

  useEffect(() => {
    let cancelled = false;
    const hydrationReset = window.setTimeout(() => {
      if (!cancelled) setHydrated(false);
    }, 0);

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
        const hydratedForm = developmentPrefillEnabled && serverFormIsEmpty
          ? createDevelopmentProjectDefaults(server.categoryKey)
          : server.formData;
        const serverData: ProjectData = {
          ...emptyProject,
          ...hydratedForm,
          projectId,
          categoryKey: server.categoryKey,
          categoryLabel: server.categoryLabel,
          revision: server.revision,
          generated: undefined,
        };
        persistence.setRevision(server.revision);
        dataRef.current = serverData;
        setData(serverData);
        // 空项目在开发期装载示例数据后应触发一次自动保存；否则刷新页面又会回到空表单。
        if (developmentPrefillEnabled && serverFormIsEmpty) {
          changeVersionRef.current += 1;
          setLocalChangeVersion(changeVersionRef.current);
        }
        const firstIncomplete = firstIncompleteFor(serverData);
        setActiveStep(initialStep > firstIncomplete ? firstIncomplete : initialStep);
        setHydrated(true);
        if (server.latestGeneration) void resumeDraftGeneration(projectId, server.latestGeneration);
      });
      return () => {
        cancelled = true;
        window.clearTimeout(hydrationReset);
      };
    }

    const localHydration = window.setTimeout(() => {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          const canonical = canonicalizeProjectFormData(JSON.parse(saved));
          const parsed = toWorkspaceCompatibilityState(canonical, dataRef.current.categoryKey) as Partial<ProjectData>;
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
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(hydrationReset);
      window.clearTimeout(localHydration);
    };
    // Route step changes must not rehydrate or replace a newer in-memory form snapshot.
    // Persistence owns stable refs/setters; recreating its façade must not rehydrate the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, storageKey]);

  // Direct links cannot bypass earlier incomplete steps.
  useEffect(() => {
    if (!hydrated) return;
    const targetStep = initialStep > firstIncompleteStep ? firstIncompleteStep : initialStep;
    const guardUpdate = window.setTimeout(() => {
      setActiveStep((current) => current === targetStep ? current : targetStep);
      if (targetStep !== initialStep && data.projectId) router.replace(`/projects/${data.projectId}/${workspaceSlugFor(targetStep)}`);
    }, 0);
    return () => window.clearTimeout(guardUpdate);
  }, [hydrated, initialStep, firstIncompleteStep, data.projectId, router]);

  // 未创建项目的草稿先写进 localStorage，创建成功（POST 返回 id）后再挂到项目保存。
  useEffect(() => {
    if (!hydrated || data.projectId) return;
    try {
      window.localStorage.setItem(projectStorageKey(undefined), JSON.stringify(toProjectFormData(data)));
    } catch {
      // 忽略隐私模式/配额异常，不打断填写。
    }
  }, [hydrated, data]);
  useEffect(() => {
    if (!hydrated || !dataRef.current.projectId || localChangeVersion === 0) return;
    persistence.schedule(workspaceSlugFor(activeStep));
    // 这里只依赖本地变更序号；表单转换延迟到防抖结束后执行。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, localChangeVersion]);

  // 第七环节只展示当前项目最新一份可用报告。
  useEffect(() => {
    if (activeStep !== 6 || !data.projectId) return;
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
  }, [activeStep, data.projectId]);

  function commit(next: Partial<ProjectData>, message = "已保存") {
    const touchesGenerated = "generated" in next;
    // 非生成动作（用户修改表单）必须失效已生成的草稿，避免下载/预览与当前确认事实不一致的旧文档。
    const changes = touchesGenerated ? next : { ...next, generated: undefined, generatedMarkdown: "" };
    const merged = { ...dataRef.current, ...changes };
    dataRef.current = merged; // 同步最新值，保证 persistNow / goToStep 导航前 flush 不丢改动。
    setData(merged);
    // 生成进度和预览只属于浏览器会话，不是问卷事实。若也触发 PUT，
    // 会无意义地递增项目 revision，并把刚创建的生成任务标为过期。
    if (!touchesGenerated) {
      setPreflightIssues([]);
      setAcknowledgedPreflightIssues([]);
      autoGenerationAfterReviewRef.current = null;
      changeVersionRef.current += 1;
      setLocalChangeVersion(changeVersionRef.current);
    }
    setStatusMessage(message);
  }

  async function ensureProjectId(): Promise<string> {
    if (dataRef.current.projectId) return dataRef.current.projectId;
    if (!creationKeyRef.current) {
      creationKeyRef.current = resolveProjectCreationKey(
        projectCreationStorage(),
        null,
        () => `project-create-${createBrowserId()}`,
      );
    }
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
      body: JSON.stringify({
        categoryKey: dataRef.current.categoryKey,
        idempotencyKey: creationKeyRef.current,
        usageConfirmation: usageConfirmationRequest,
        formData: toProjectFormData(dataRef.current),
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message || "项目创建失败，请检查数据库连接");
    }
    const payload = await res.json() as { data: { id: string; revision: number } };
    const mergedProject = { ...dataRef.current, projectId: payload.data.id, revision: payload.data.revision };
    dataRef.current = mergedProject;
    setData(mergedProject);
    persistence.setRevision(payload.data.revision);
    assistant.persistSessionForProject(payload.data.id);
    clearProjectCreationKey(projectCreationStorage());
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
    if (step > 5 && !canGenerate) {
      setStatusMessage("请先补齐用户权利、联系渠道和必填补充信息");
      setActiveStep(5);
      return;
    }
    // 步骤切换可能触发客户端组件重挂载（路由段变化），重挂载后按服务器数据
    // 水合。必须先把未落库的最新填写 flush 到服务器，否则守卫会因读到旧数据
    // 把用户弹回上一个未完成步骤。
    const id = dataRef.current.projectId;
    if (id) {
      const saved = await persistence.persistNow(workspaceSlugFor(step));
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
      const saved = await persistence.persistNow(workspaceSlugFor(activeStep));
      setStatusMessage(saved.ok ? "已保存，正在返回项目列表" : "保存失败，请稍后重试");
      router.push("/projects");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "项目创建失败");
    }
  }

  const {
    updateProfile,
    toggleProfilePreset,
    updateProfileOther,
    toggleFeature,
    togglePurposePreset,
    updatePurposeOther,
    updateInformationOther,
    togglePresetFeature,
    removeCustomFeature,
    toggleCustomInformationPreset,
    toggleCustomPurposePreset,
    updateCustomPurposeOther,
    togglePermission,
    addCustomPermission,
    updateCustomPermission,
    removePermission,
    togglePermissionScene,
    updatePermissionScene,
    addPartner,
    updatePartner,
    removePartner,
    togglePartnerPurpose,
    togglePartnerListValue,
    updatePartnerOtherValues,
    confirmPartners,
    toggleStorageValue,
    updateStorageText,
    confirmStorageAndContinue,
    toggleSecurityMeasure,
    updateSecurityOther,
    addCustomFeature,
    toggleField,
    updateSupplement,
    toggleQuestionDetailPreset,
    updateQuestionDetailOther,
    updateSupplementSlot,
    toggleSupplementSlotPreset,
    updateSupplementSlotOther,
    extractSupplementSlots,
  } = useWorkspaceFormActions({
    data,
    questionnaire,
    commit,
    customName,
    setCustomName,
    setCustomOpen,
    setStatusMessage,
    setExtractingQuestionId,
    selectedFieldItems,
    fieldAnswer,
    goToStep,
  });

  function editPreflightIssue(issue: PreflightIssue) {
    const target: StepIndex = issue.targetStep === "profile" ? 0 : issue.targetStep === "features" || issue.targetStep === "review" ? 1 : 5;
    goToStep(target);
    setStatusMessage(issue.questionForUser);
  }

  function acknowledgePreflightIssue(issue: DisplayPreflightIssue) {
    setAcknowledgedPreflightIssues((current) => [...new Set([...current, issue.fingerprint])].slice(-20));
    setStatusMessage("已确认当前填写；全部核对完成后将自动继续生成");
  }

  async function handleDraftAction(preflightAcknowledgements = acknowledgedPreflightIssues) {
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
    const saved = await persistence.persistNow("generate");
    if (!saved.ok) return;
    const generationId = `web_${createBrowserId()}`;
    await runDraftGeneration(id, generationId, preflightAcknowledgements);
  }

  useEffect(() => {
    if (preflightIssues.length === 0 || data.generated?.status === "GENERATING") return;
    const allAcknowledged = preflightIssues.every((issue) => acknowledgedPreflightIssues.includes(issue.fingerprint));
    if (!allAcknowledged) return;
    const reviewKey = preflightIssues.map((issue) => issue.fingerprint).sort().join("|");
    if (autoGenerationAfterReviewRef.current === reviewKey) return;
    autoGenerationAfterReviewRef.current = reviewKey;
    setStatusMessage("全部产品事实已确认，正在继续查询相关法规");
    void handleDraftAction(acknowledgedPreflightIssues);
    // handleDraftAction intentionally uses the values from this completed review render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acknowledgedPreflightIssues, preflightIssues, data.generated?.status]);

  const draftFields = selectedFieldItems.map((field) => ({ ...field, selected: fieldAnswer(field.id) === "PROCESS" }));
  const displayedGenerationStages = liveGeneration?.stages ?? INITIAL_GENERATION_STAGES;
  const activeGenerationStage = displayedGenerationStages.find((stage) => stage.status === "ACTIVE");
  const generationChapterProgress = liveGeneration?.totalSections
    ? Math.min(100, Math.round((liveGeneration.completedSections / liveGeneration.totalSections) * 100))
    : 0;

  const renderSupplementQuestion = (questionId: string) => {
    const question = supplementQuestions.find((item) => item.id === questionId);
    if (!question) return null;
    return <SupplementQuestion key={question.id} question={question} data={data} extractingQuestionId={extractingQuestionId} updateSupplement={updateSupplement} toggleQuestionDetailPreset={toggleQuestionDetailPreset} updateQuestionDetailOther={updateQuestionDetailOther} updateSupplementSlot={updateSupplementSlot} toggleSupplementSlotPreset={toggleSupplementSlotPreset} updateSupplementSlotOther={updateSupplementSlotOther} extractSupplementSlots={extractSupplementSlots} />;
  };

  if (!hydrated) return <main className="workspace-page workspace-v3 w-full max-w-full"><header className="workspace-v3-header"><BaijianBrand /></header><section className="workspace-panel" aria-busy="true">正在加载项目数据…</section></main>;

  return (
    <main className="workspace-page workspace-v3 w-full max-w-full">
      <header className="workspace-v3-header">
        <BaijianBrand />
        <div className="workspace-v3-header-actions">
          {saveState === "saving" ? <span className="status-pending">保存中…</span> : saveState === "saved" ? <span className="status-complete"><CheckCircle weight="fill" /> 已保存</span> : saveState === "error" ? <span className="status-error">保存失败</span> : null}
          <button type="button" className="workspace-v3-exit" onClick={handleSaveAndExit}>暂存退出</button>
        </div>
      </header>

      <div className="workspace-v3-breadcrumb">项目 <span>/</span> {data.profile.productName || `新${data.categoryLabel}项目`} <em className="category-pill">{data.categoryLabel}类</em></div>

      <section className="workspace-v3-progress">
        <div className="workspace-v3-progress-heading">
          <h1>{data.profile.productName ? `${data.profile.productName}隐私政策` : `${data.categoryLabel}类隐私政策`}</h1>
          <div><strong>第 {activeStep + 1} / {steps.length} 步 · {steps[activeStep]}</strong><span>完成度 {completionPercent}%</span></div>
        </div>
        <div className="workspace-v3-progress-line" aria-label={`项目完成度 ${completionPercent}%`}><span style={{ width: `${completionPercent}%` }} /></div>
        <ol className="workspace-stepper" aria-label="表单流程">
          {steps.map((step, index) => <li key={step} data-active={activeStep === index} data-complete={completedSteps[index]}><button type="button" onClick={() => goToStep(index as StepIndex)}><span className="stepper-node">{completedSteps[index] ? <Check weight="bold" /> : index + 1}</span><span className="stepper-label">{step}</span></button></li>)}
        </ol>
      </section>

      <div className="workspace-v3-content" data-assistant-open={assistant.open}>
        <div className="workspace-v3-form">
          <div className="workspace-status" role="status" aria-live="polite">{statusMessage}</div>

          {activeStep === 0 && <BasicInformationStep data={data} complete={basicProfileComplete} onUpdate={updateProfile} onTogglePreset={toggleProfilePreset} onUpdateOther={updateProfileOther} onNext={() => void goToStep(1)} />}

          {activeStep === 1 && <ProcessingActivitiesStep data={data} questionnaire={questionnaire} scenarios={scenarios} basicFeatureIds={basicFeatureIds} selectedScenarios={selectedScenarios} selectedCustomFeatures={selectedCustomFeatures} draftFields={draftFields} customOpen={customOpen} customName={customName} canContinue={canReview} onToggleFeature={toggleFeature} onTogglePresetFeature={togglePresetFeature} onSetCustomOpen={setCustomOpen} onSetCustomName={setCustomName} onAddCustomFeature={addCustomFeature} onRemoveCustomFeature={removeCustomFeature} onToggleField={toggleField} onUpdateInformationOther={updateInformationOther} onTogglePurposePreset={togglePurposePreset} onUpdatePurposeOther={updatePurposeOther} onToggleCustomInformationPreset={toggleCustomInformationPreset} onToggleCustomPurposePreset={toggleCustomPurposePreset} onUpdateCustomPurposeOther={updateCustomPurposeOther} onUpdateNotes={(value) => commit({ additionalNotes: value }, "补充信息已保存")} onBack={() => void goToStep(0)} onNext={() => void goToStep(2)} />}

          {activeStep === 2 && <DevicePermissionsStep data={data} permissionPresets={questionnaire.permissionPresets} complete={permissionDetailsComplete} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} onTogglePermission={togglePermission} onAddCustomPermission={addCustomPermission} onUpdateCustomPermission={updateCustomPermission} onRemovePermission={removePermission} onToggleScene={togglePermissionScene} onUpdateScene={updatePermissionScene} onBack={() => void goToStep(1)} onNext={() => void goToStep(3)} />}

          {activeStep === 3 && <PartnersStep data={data} purposePresets={questionnaire.partnerPurposePresets} informationPresets={questionnaire.partnerInformationPresets} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} onConfirm={confirmPartners} onAdd={addPartner} onRemove={removePartner} onUpdate={updatePartner} onTogglePurpose={togglePartnerPurpose} onToggleListValue={togglePartnerListValue} onUpdateOtherValues={updatePartnerOtherValues} onBack={() => void goToStep(2)} onNext={() => void goToStep(4)} />}

          {activeStep === 4 && <StorageSecurityStep data={data} complete={storageDetailsComplete} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} onToggleValue={toggleStorageValue} onUpdateText={updateStorageText} onToggleSecurityMeasure={toggleSecurityMeasure} onUpdateSecurityOther={updateSecurityOther} onBack={() => void goToStep(3)} onNext={() => void confirmStorageAndContinue()} />}

          {activeStep === 5 && <RightsStep data={data} renderSupplementQuestion={(id) => renderSupplementQuestion(id)} complete={canGenerate} blockingDiagnostic={formalReadiness.diagnostics.filter((item) => item.severity === "BLOCKING").map((item) => item.message).join("；")} onUpdateProfile={updateProfile} onToggleProfilePreset={toggleProfilePreset} onUpdateProfileOther={updateProfileOther} onUpdateNotes={(value) => commit({ additionalNotes: value }, "补充信息已保存")} onBack={() => void goToStep(4)} onNext={() => void goToStep(6)} />}

          {activeStep === 6 && <GenerationStep data={data} selectedCount={selectedCount} processedFieldCount={processedFieldCount} completedSupplementCount={completedSupplementCount} supplementCount={supplementQuestions.length} blockingDiagnostic={formalReadiness.diagnostics.filter((item) => item.severity === "BLOCKING").map((item) => item.message).join("；")} preflightIssues={preflightIssues} acknowledgedIssues={acknowledgedPreflightIssues} generationStages={displayedGenerationStages} activeGenerationStage={activeGenerationStage} liveGeneration={liveGeneration} generationElapsed={generationElapsed} generationChapterProgress={generationChapterProgress} history={latestSuccessfulHistory} canGenerate={canGenerate} onEditIssue={editPreflightIssue} onAcknowledgeIssue={acknowledgePreflightIssue} onDownload={(item) => downloadReport(item.downloadUrl)} onBack={() => void goToStep(5)} onGenerate={() => void handleDraftAction()} />}
        </div>

        <AssistantPanel
          open={assistant.open}
          messages={assistant.messages}
          attachments={assistant.attachments}
          attachmentsCollapsed={assistant.attachmentsCollapsed}
          input={assistant.input}
          sending={assistant.sending}
          error={assistant.error}
          hasReadingAttachment={assistant.hasReadingAttachment}
          readyAttachmentCount={assistant.readyAttachments.length}
          onToggle={assistant.toggleOpen}
          onClear={assistant.clear}
          onSend={(prompt, appendUserMessage) => void assistant.send(prompt, appendUserMessage)}
          onCopy={(content) => void assistant.copy(content)}
          onApplySuggestion={assistant.applySuggestion}
          onInput={assistant.setInput}
          onFiles={assistant.addFiles}
          onToggleAttachments={assistant.toggleAttachments}
          onToggleAttachmentFactUse={assistant.toggleAttachmentFactUse}
          onRemoveAttachment={assistant.removeAttachment}
        />
      </div>
    </main>
  );
}
