import type { FormPayload } from "@/src/ai/deepseek";
import { mapV1Content } from "@/src/content/map-v1";
import { getAppQuestionnaire } from "@/src/questionnaires";
import { getRequiredSupplementQuestions, getSlotScenario } from "./map-cn";
import { SupplementAnswerSchema, type SupplementAnswer } from "./map-cn/schema";

export type ReadinessDiagnostic = {
  code: "OUT_OF_SCOPE" | "NEEDS_CUSTOMER_INPUT" | "NEEDS_PRODUCT_OR_TECH" | "NEEDS_LEGAL_REVIEW";
  severity: "BLOCKING" | "WARNING";
  message: string;
  target?: string;
};

export type FormalPolicyReadiness = {
  ready: boolean;
  diagnostics: ReadinessDiagnostic[];
  requiredQuestionIds: string[];
  answers: Record<string, SupplementAnswer>;
};

export type FieldAnswer = "PROCESS" | "NOT_PROCESS";

/**
 * Older projects only stored a checked field list. A historical check means
 * “process”; all new decisions are explicit so “does not process” cannot be
 * mistaken for an incomplete answer.
 */
export function resolveFieldAnswer(input: { fieldAnswers?: Record<string, FieldAnswer>; confirmedFields: string[] }, fieldId: string): FieldAnswer | undefined {
  const explicit = input.fieldAnswers?.[fieldId];
  if (explicit) return explicit;
  if (input.confirmedFields.includes(fieldId)) return "PROCESS";

  // 历史数据以 `${featureKey}.${index}` 记录。两个方向都需要兼容：
  // 1) 传入的是旧 index 键 → 映射到稳定键；
  // 2) 传入的是稳定键 → 检查是否存在映射到它的旧 index 键。
  const stable = fieldIdFromLegacy(fieldId);
  if (stable && stable !== fieldId) {
    const stableExplicit = input.fieldAnswers?.[stable];
    if (stableExplicit) return stableExplicit;
    if (input.confirmedFields.includes(stable)) return "PROCESS";
    return undefined;
  }
  for (const key of [...Object.keys(input.fieldAnswers ?? {}), ...input.confirmedFields]) {
    if (fieldIdFromLegacy(key) === fieldId) {
      const legacyExplicit = input.fieldAnswers?.[key];
      if (legacyExplicit) return legacyExplicit;
      return "PROCESS";
    }
  }
  return undefined;
}

function fieldIdFromLegacy(fieldId: string): string | null {
  const match = /^([a-z][a-z0-9_-]{1,63})\.(\d+)$/.exec(fieldId);
  if (!match) return null;
  const feature = mapV1Content.payload.features.find((item) => item.key === match[1]);
  const index = Number(match[2]);
  const field = feature?.fields[index];
  return field ? `${feature.key}.${field.key}` : null;
}

const profileKeys = ["operatorName", "operatorContact", "productName", "productVersion", "contactEmail", "rightsEntry", "rightsResponsePeriod", "minorProcessing", "securityMeasures", "incidentChannel", "policyEffectiveDate", "policyUpdateNotice"] as const;

export function evaluateFormalPolicyReadiness(input: FormPayload & { supplementAnswers?: Record<string, SupplementAnswer> }, categoryKey = "map-navigation"): FormalPolicyReadiness {
  const diagnostics: ReadinessDiagnostic[] = [];
  for (const key of profileKeys) {
    if (!(input.profile[key] ?? "").trim()) diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `profile.${key}`, message: "通用披露信息尚未填写完整。" });
  }
  for (const feature of input.selected) {
    const detail = input.activityDetails[feature];
    if (!detail?.purpose?.trim()) diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `activity.${feature}`, message: "每个已选功能都需要确认实际处理目的。" });
  }
  for (const feature of input.customFeatures) {
    const detail = input.customDetails[feature];
    if (!detail?.purpose?.trim()) diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `custom.${feature}`, message: `自定义功能“${feature}”缺少处理目的。` });
  }

  // 至少确认一项实际处理的个人信息：未勾选任何信息项的草稿没有披露内容。
  const selectedFeatures = getAppQuestionnaire(categoryKey).features.filter((feature) => input.selected.includes(feature.key));
  const hasProcessedField = selectedFeatures.some((feature) => feature.fields.some((field, index) => resolveFieldAnswer(input, `${feature.key}.${field.key}`) === "PROCESS" || resolveFieldAnswer(input, `${feature.key}.${index}`) === "PROCESS"));
  const categoryAllowsBasicUseWithoutPersonalInformation = getAppQuestionnaire(categoryKey)
    .necessaryInfoSummary === "无需个人信息即可使用基本功能";
  if (selectedFeatures.length > 0 && !hasProcessedField && !categoryAllowsBasicUseWithoutPersonalInformation) {
    diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: "fields", message: "请至少勾选一项产品实际处理的个人信息。" });
  }

  const requiredQuestions = getRequiredSupplementQuestions(input, categoryKey);
  const answers: Record<string, SupplementAnswer> = {};
  for (const question of requiredQuestions) {
    const result = SupplementAnswerSchema.safeParse(input.supplementAnswers?.[question.id]);
    if (!result.success) {
      diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `question.${question.id}`, message: `请确认“${question.title}”。` });
      continue;
    }
    answers[question.id] = result.data;
    if (result.data.answer === "UNKNOWN") diagnostics.push({ code: "NEEDS_PRODUCT_OR_TECH", severity: "BLOCKING", target: `question.${question.id}`, message: question.unknownMessage });
    if (result.data.answer === "YES") {
      const slotScenario = getSlotScenario(question.id);
      if (!slotScenario && !result.data.detail.trim()) {
        diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `question.${question.id}`, message: `“${question.title}”已选择“有”，请补充具体事实。` });
      }
      for (const slot of slotScenario?.slots.filter((item) => item.required) ?? []) {
        const value = result.data.slots[slot.id];
        if (!value?.value.trim() || value.status !== "CONFIRMED") {
          diagnostics.push({
            code: "NEEDS_CUSTOMER_INPUT",
            severity: "BLOCKING",
            target: `question.${question.id}.slot.${slot.id}`,
            message: `请确认“${question.title}”中的“${slot.label}”。`,
          });
          continue;
        }
        if (slot.inputType === "url" && !isPublicHttpUrl(value.value)) {
          diagnostics.push({
            code: "NEEDS_CUSTOMER_INPUT",
            severity: "BLOCKING",
            target: `question.${question.id}.slot.${slot.id}`,
            message: `“${question.title}”中的“${slot.label}”需要填写完整的 http 或 https 链接。`,
          });
        }
      }
    }
  }
  return { ready: !diagnostics.some((item) => item.severity === "BLOCKING"), diagnostics, requiredQuestionIds: requiredQuestions.map((item) => item.id), answers };
}

function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
