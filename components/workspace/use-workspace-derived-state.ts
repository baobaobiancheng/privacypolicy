"use client";

import { useMemo } from "react";
import { mapV1Content } from "@/src/content/map-v1";
import { scenarios } from "@/src/content/map-v1/ui-content";
import { getRequiredSupplementQuestions, getSlotScenario } from "@/src/knowledge/map-cn";
import { evaluateFormalPolicyReadiness, resolveFieldAnswer } from "@/src/knowledge/readiness";
import type { FormPayload } from "@/src/ai/deepseek";
import {
  BASIC_FEATURE_IDS,
  basicProfileFields,
  profileFields,
  rightsProfileFields,
  type ProjectData,
  type SnapshotItem,
  type StepIndex,
} from "./workspace-model";

export function useWorkspaceDerivedState(data: ProjectData, activeStep: StepIndex, history: SnapshotItem[] | null) {
  return useMemo(() => deriveWorkspaceState(data, activeStep, history), [activeStep, data, history]);
}

function deriveWorkspaceState(data: ProjectData, activeStep: StepIndex, history: SnapshotItem[] | null) {
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
  const selectedDetailsComplete = selectedScenarios.every((scenario) => Boolean(data.activityDetails[scenario.id]?.purpose.trim()))
    && selectedCustomFeatures.every((feature) => Boolean(data.customDetails[feature]?.purpose.trim()));
  const basicProfileComplete = basicProfileFields.every(([key]) => Boolean(data.profile[key]?.trim()));
  const profileComplete = profileFields
    .filter(([key]) => key !== "contactPhone")
    .every(([key]) => Boolean(data.profile[key]?.trim()));
  const supplementQuestions = getRequiredSupplementQuestions({
    selected: data.selected,
    customFeatures: data.customFeatures,
    supplementAnswers: data.supplementAnswers,
  });
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
      if (slot.inputType !== "url") return true;
      try {
        const url = new URL(value.value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
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
  const firstIncompleteStep: StepIndex = !basicProfileComplete
    ? 0
    : !data.selected.length || !selectedDetailsComplete || processedFieldCount === 0
      ? 1
      : !permissionDetailsComplete
        ? 2
        : !data.supplementAnswers["third-party-services"]
          ? 3
          : !data.supplementAnswers["storage-locations"] || !data.profile.securityMeasures?.trim()
            ? 4
            : !canGenerate
              ? 5
              : 6;
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
    canGenerate,
    data.generated?.status === "SUCCEEDED",
  ];
  const completionPercent = Math.round(completedSteps.filter(Boolean).length / completedSteps.length * 100);
  const assistantPrompt = [
    "基本信息会用于政策标题、运营主体和生效日期。",
    "按功能选择产品实际处理的个人信息和处理目的；行业示例不会自动成为产品事实。",
    "只选择产品实际调用的设备权限，并说明对应使用场景。",
    "SDK 与合作方信息需要以实际接入情况和公开隐私政策链接为准。",
    "保存期限在这里统一选择，不再按每项功能重复填写。",
    "补齐用户权利、联系渠道和其他治理信息后，再进入独立的政策生成环节。",
    "系统会汇总已确认事实，检查矛盾、查询法规并生成可预览和下载的隐私政策。",
  ][activeStep];
  const assistantStepFields = buildAssistantStepFields({
    activeStep,
    data,
    selectedScenarios,
    selectedCustomFeatures,
    selectedFieldItems,
    fieldAnswer,
    hasBasicFeature,
    permissionDetailsComplete,
  });
  const assistantProjectFacts = buildAssistantProjectFacts(data, selectedScenarios, selectedCustomFeatures, selectedFieldItems, fieldAnswer);

  return {
    selectedScenarios,
    selectedCustomFeatures,
    selectedFieldItems,
    fieldAnswer,
    processedFieldCount,
    selectedDetailsComplete,
    basicProfileComplete,
    profileComplete,
    supplementQuestions,
    effectiveSupplementAnswers,
    completedSupplementCount,
    formalReadiness,
    warningCount,
    hasBasicFeature,
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
  };
}

type SelectedScenario = (typeof scenarios)[number];
type SelectedField = { id: string; featureId: string; feature: string; label: string };

function buildAssistantStepFields(input: {
  activeStep: StepIndex;
  data: ProjectData;
  selectedScenarios: SelectedScenario[];
  selectedCustomFeatures: string[];
  selectedFieldItems: SelectedField[];
  fieldAnswer: (fieldId: string) => "PROCESS" | "NOT_PROCESS" | undefined;
  hasBasicFeature: boolean;
  permissionDetailsComplete: boolean;
}) {
  const { activeStep, data, selectedScenarios, selectedCustomFeatures, selectedFieldItems, fieldAnswer, hasBasicFeature, permissionDetailsComplete } = input;
  if (activeStep === 0) return basicProfileFields.map(([key, label]) => ({ key, label, value: data.profile[key] ?? "", required: true, complete: Boolean(data.profile[key]?.trim()) }));
  if (activeStep === 1) return [
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
  ];
  if (activeStep === 2) return [
    { key: "device-permissions", label: "设备权限使用情况", value: data.supplementAnswers["device-permissions"]?.answer ?? "", required: true, complete: Boolean(data.supplementAnswers["device-permissions"]) },
    { key: "permission-items", label: "实际使用的权限及场景", value: factValue(data.permissions), required: data.supplementAnswers["device-permissions"]?.answer === "YES", complete: permissionDetailsComplete },
  ];
  if (activeStep === 3) return [
    { key: "third-party-services", label: "SDK 与合作方使用情况", value: data.supplementAnswers["third-party-services"]?.answer ?? "", required: true, complete: Boolean(data.supplementAnswers["third-party-services"]) },
    { key: "partner-items", label: "SDK 与合作方明细", value: factValue(data.partners), required: data.supplementAnswers["third-party-services"]?.answer === "YES", complete: data.supplementAnswers["third-party-services"]?.answer !== "YES" || data.partners.length > 0 },
  ];
  if (activeStep === 4) return [
    { key: "storage-locations", label: "存储位置", value: factValue(data.storageAndSecurity.locations), required: true, complete: Boolean(data.storageAndSecurity.locations?.length) },
    { key: "retention-policies", label: "保存期限原则", value: factValue(data.storageAndSecurity.retentionPolicies), required: true, complete: Boolean(data.storageAndSecurity.retentionPolicies?.length) },
    { key: "expiry-actions", label: "期限届满后的处理方式", value: factValue(data.storageAndSecurity.expiryActions), required: true, complete: Boolean(data.storageAndSecurity.expiryActions?.length) },
    { key: "security-measures", label: "实际采取的安全措施", value: data.profile.securityMeasures ?? "", required: true, complete: Boolean(data.profile.securityMeasures?.trim()) },
  ];
  if (activeStep === 5) return rightsProfileFields.map(([key, label]) => ({ key, label, value: data.profile[key] ?? "", required: key !== "contactPhone", complete: key === "contactPhone" || Boolean(data.profile[key]?.trim()) }));
  return [
    { key: "generation-features", label: "已确认产品功能", value: String(data.selected.length + data.customFeatures.length), required: true, complete: data.selected.length + data.customFeatures.length > 0 },
    { key: "generation-rights", label: "用户权利与联系信息", value: data.profile.rightsEntry ?? "", required: true, complete: Boolean(data.profile.rightsEntry?.trim()) },
    { key: "generation-status", label: "隐私政策生成状态", value: data.generated?.status ?? "尚未生成", required: false, complete: data.generated?.status === "SUCCEEDED" },
  ];
}

function buildAssistantProjectFacts(
  data: ProjectData,
  selectedScenarios: SelectedScenario[],
  selectedCustomFeatures: string[],
  selectedFieldItems: SelectedField[],
  fieldAnswer: (fieldId: string) => "PROCESS" | "NOT_PROCESS" | undefined,
) {
  const facts: Array<{ section: string; label: string; value: string }> = [];
  for (const [key, label] of profileFields) {
    const value = data.profile[key]?.trim();
    if (value) facts.push({ section: "基本信息与用户权利", label, value: value.slice(0, 4_000) });
  }
  for (const scenario of selectedScenarios) {
    const selectedInformation = selectedFieldItems.filter((field) => field.featureId === scenario.id && fieldAnswer(field.id) === "PROCESS").map((field) => field.label);
    const manualInformation = data.processingActivities.find((item) => item.featureKey === scenario.id)?.informationOther ?? [];
    const information = [...new Set([...selectedInformation, ...manualInformation])].join("、");
    facts.push({ section: "功能与个人信息", label: scenario.title, value: `个人信息：${information || "尚未选择"}；处理目的：${data.activityDetails[scenario.id]?.purpose || "尚未填写"}` });
  }
  for (const feature of selectedCustomFeatures) {
    const activity = data.processingActivities.find((item) => item.featureKey === `custom:${feature}`);
    const information = [...new Set([...(activity?.informationItems ?? []), ...(activity?.informationOther ?? [])])].join("、");
    facts.push({ section: "功能与个人信息", label: feature, value: `个人信息：${information || "尚未选择"}；处理目的：${data.customDetails[feature]?.purpose || "尚未填写"}` });
  }
  const structuredFacts: Array<[string, string, unknown]> = [
    ["设备权限", "权限清单", data.permissions],
    ["SDK 与合作方", "合作方清单", data.partners],
    ["存储与安全", "存储和安全规则", data.storageAndSecurity],
    ["用户权利", "权利与治理", data.rightsAndGovernance],
    ["补充信息", "补充问卷", data.supplementAnswers],
  ];
  for (const [section, label, source] of structuredFacts) {
    const value = factValue(source);
    if (value) facts.push({ section, label, value: value.slice(0, 4_000) });
  }
  if (data.additionalNotes.trim()) facts.push({ section: "补充信息", label: "其他补充信息", value: data.additionalNotes.trim().slice(0, 4_000) });
  return facts;
}

function factValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(factValue).filter(Boolean).join("、");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = factValue(item);
        return text ? `${key}：${text}` : "";
      })
      .filter(Boolean)
      .join("；");
  }
  return value === undefined || value === null ? "" : String(value);
}
