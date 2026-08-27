import type { SupplementAnswer } from "@/src/knowledge/map-cn/schema";
import type { AppQuestionnaire, PermissionPreset, QuestionnairePresetFeature } from "@/src/questionnaires";
import {
  CLIENT_PERSONA_ID,
  SECURITY_PRESETS,
  type ActivityDetail,
  type ProjectData,
  type StepIndex,
} from "@/components/workspace/workspace-model";

type Commit = (next: Partial<ProjectData>, message?: string) => void;
type SelectedFieldItem = { id: string; label: string };

type WorkspaceFormActionOptions = {
  data: ProjectData;
  questionnaire: AppQuestionnaire;
  commit: Commit;
  customName: string;
  setCustomName: (value: string) => void;
  setCustomOpen: (value: boolean) => void;
  setStatusMessage: (value: string) => void;
  setExtractingQuestionId: (value: string | null) => void;
  selectedFieldItems: SelectedFieldItem[];
  fieldAnswer: (fieldId: string) => "PROCESS" | "NOT_PROCESS" | undefined;
  goToStep: (step: StepIndex) => Promise<void>;
};

export function useWorkspaceFormActions(options: WorkspaceFormActionOptions) {
  const {
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
  } = options;

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
    const presets = questionnaire.features.find((feature) => feature.key === id)?.purposes ?? [];
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

  function togglePresetFeature(feature: QuestionnairePresetFeature) {
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
    const preset = questionnaire.additionalFeatures.find((item) => item.title === feature);
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

  function togglePermission(preset: PermissionPreset) {
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
      supplementAnswers: { ...data.supplementAnswers, "storage-locations": buildStorageConfirmation(storageAndSecurity) },
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
    const storageAndSecurity = data.storageAndSecurity;
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

  function toggleQuestionDetailPreset(questionId: string, value: string) {
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

  function toggleSupplementSlotPreset(questionId: string, slotId: string, value: string) {
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


  return {
    updateProfile,
    toggleProfilePreset,
    updateProfileOther,
    toggleFeature,
    updateActivityDetail,
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
  };
}
