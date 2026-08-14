import type { FormPayload } from "@/src/ai/deepseek";
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
  return input.fieldAnswers?.[fieldId] ?? (input.confirmedFields.includes(fieldId) ? "PROCESS" : undefined);
}

const profileKeys = ["operatorName", "operatorContact", "productName", "productVersion", "contactEmail", "rightsEntry", "rightsResponsePeriod", "minorProcessing", "securityMeasures", "incidentChannel", "policyEffectiveDate", "policyUpdateNotice"] as const;

export function evaluateFormalPolicyReadiness(input: FormPayload & { scopeAnswers?: Record<string, boolean>; supplementAnswers?: Record<string, SupplementAnswer> }): FormalPolicyReadiness {
  const diagnostics: ReadinessDiagnostic[] = [];
  const scopeAnswers = input.scopeAnswers ?? {};
  for (const gate of ["single-product", "map-primary", "single-category", "no-cross-border"]) {
    if (scopeAnswers[gate] !== true) diagnostics.push({ code: "OUT_OF_SCOPE", severity: "BLOCKING", target: gate, message: "当前项目未通过地图类首期范围门禁，不能生成隐私政策草稿。" });
  }
  for (const key of profileKeys) {
    if (!(input.profile[key] ?? "").trim()) diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `profile.${key}`, message: "通用披露信息尚未填写完整。" });
  }
  for (const feature of input.selected) {
    const detail = input.activityDetails[feature];
    if (!detail?.purpose?.trim() || !detail.retention?.trim()) diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `activity.${feature}`, message: "每个已选功能都需要填写实际处理目的和保存期限。" });
  }
  for (const feature of input.customFeatures) {
    const detail = input.customDetails[feature];
    if (!detail?.purpose?.trim() || !detail.retention?.trim()) diagnostics.push({ code: "NEEDS_CUSTOMER_INPUT", severity: "BLOCKING", target: `custom.${feature}`, message: `自定义功能“${feature}”缺少处理目的或保存期限。` });
  }

  const requiredQuestions = getRequiredSupplementQuestions(input);
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
