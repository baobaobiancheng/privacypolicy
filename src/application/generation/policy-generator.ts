import { createHash } from "node:crypto";
import { verifiedMapV1Content } from "@/src/content/map-v1/server-content";
import { buildDraftPlan } from "@/src/domain/draft/export-plan";
import { evaluateExportInvariants, type ActivityFacts } from "@/src/domain/rules";
import { renderDraftDocx } from "@/src/documents/render-draft";
import {
  analyzeFormBeforeGeneration,
  generatePolicyDraft,
  type GenerationPreflight,
  type PolicyGenerationProgress,
} from "@/src/ai/deepseek";
import { evaluateFormalPolicyReadiness, resolveFieldAnswer } from "@/src/knowledge/readiness";
import { getSlotScenario, mapCnKnowledgePackage } from "@/src/knowledge/map-cn";
import { searchLawsByKeywords, type LawKeywordSearchResult } from "@/src/law/baijian";
import { DomainError } from "@/src/domain/errors";
import type { ProjectFormData } from "@/src/workspace/contract";
import { toGenerationForm } from "@/src/workspace/form-adapter";
import { buildPolicyGenerationContext, type PolicyGenerationContext } from "./policy-generation-context";
import { filterAcknowledgedBlockingIssues } from "./preflight-acknowledgements";

export type PolicyGeneratorStage = "FACT_CHECK" | "LAW_SEARCH" | "DRAFTING" | "FINALIZING";

export type PolicyGeneratorCallbacks = {
  onStage?: (stage: PolicyGeneratorStage, message: string) => void | Promise<void>;
  onProgress?: (progress: PolicyGenerationProgress) => void;
  signal?: AbortSignal;
  acknowledgedPreflightIssues?: readonly string[];
  preflightRound?: number;
  cachedPreflight?: GenerationPreflight;
};

export type PolicyGeneratorResult = {
  filename: string;
  markdown: string;
  docx: Buffer;
  model: string;
  inputHash: string;
};

export async function generatePolicyFromProjectFacts(
  reportId: string,
  formData: ProjectFormData,
  callbacks: PolicyGeneratorCallbacks = {},
): Promise<PolicyGeneratorResult> {
  const form = toGenerationForm(formData);
  const generationContext = buildPolicyGenerationContext(formData);
  const readiness = evaluateFormalPolicyReadiness(form);
  if (!readiness.ready) {
    throw new DomainError("FORM_NOT_READY", "请先完成必填信息，再生成隐私政策。", {
      retryable: false,
      details: { diagnostics: readiness.diagnostics },
    });
  }

  const preflightRound = Math.min(3, Math.max(1, callbacks.preflightRound ?? 1));
  await callbacks.onStage?.(
    "FACT_CHECK",
    callbacks.cachedPreflight
      ? "三轮事实核对已完成，正在读取已确认结果"
      : `正在进行第 ${preflightRound}/3 轮产品事实核对`,
  );
  const preflight = callbacks.cachedPreflight
    ?? await analyzeFormBeforeGeneration(form, callbacks.signal, generationContext);
  const blockingIssues = filterAcknowledgedBlockingIssues(
    preflight.issues,
    callbacks.acknowledgedPreflightIssues ?? [],
  );
  if (blockingIssues.length > 0) {
    throw new DomainError("FORM_SEMANTIC_REVIEW_REQUIRED", "生成前发现需要核对的产品事实。", {
      retryable: false,
      details: {
        issues: blockingIssues,
        lawKeywords: preflight.lawKeywords,
        preflightRound,
      },
    });
  }

  await callbacks.onStage?.("LAW_SEARCH", "正在根据产品场景查询相关法规");
  const legalSearchResults = await searchLawsByKeywords(preflight.lawKeywords, { signal: callbacks.signal });
  await callbacks.onStage?.("DRAFTING", "智能体正在组织政策正文");
  const result = await renderPolicy(reportId, form, generationContext, legalSearchResults, callbacks);
  return {
    ...result,
    inputHash: `sha256:${createHash("sha256").update(JSON.stringify(formData)).digest("hex")}`,
  };
}

async function renderPolicy(
  reportId: string,
  form: ReturnType<typeof toGenerationForm>,
  generationContext: PolicyGenerationContext,
  legalSearchResults: LawKeywordSearchResult[],
  callbacks: PolicyGeneratorCallbacks,
): Promise<Omit<PolicyGeneratorResult, "inputHash">> {
  const input = form;
  const structuredFactKeys = collectFactPaths(generationContext, "");
  const selectedFeatures = verifiedMapV1Content.payload.features.filter((feature) => input.selected.includes(feature.key));
  const confirmedSupplementFactKeys = Object.entries(input.supplementAnswers).flatMap(([questionId, answer]) => [
    ...(answer.answer !== "UNKNOWN" ? [`supplementAnswers.${questionId}`, `supplementAnswers.${questionId}.answer`] : []),
    ...(!getSlotScenario(questionId) && answer.answer === "YES" && answer.detail ? [`supplementAnswers.${questionId}.detail`] : []),
    ...Object.entries(answer.slots ?? {}).flatMap(([slotId, slot]) => slot.status === "CONFIRMED" && slot.value
      ? [`supplementAnswers.${questionId}.slots.${slotId}.value`]
      : []),
  ]);
  const fieldAnswer = (featureKey: string, fieldKey: string) => resolveFieldAnswer(input, `${featureKey}.${fieldKey}`);
  const activities: ActivityFacts[] = selectedFeatures.map((feature) => ({
    activityKey: `activity-${feature.key}`,
    featureKey: feature.key,
    selected: true,
    requiredFields: feature.fields.filter((field) => field.required).map((field) => field.key),
    riskCode: feature.riskCode,
    assertions: feature.fields.map((field) => ({
      assertionId: `${reportId}-${feature.key}-${field.key}`,
      activityKey: `activity-${feature.key}`,
      fieldKey: field.key,
      value: field.label,
      originType: "CLIENT_ORIGINAL" as const,
      factVerification: fieldAnswer(feature.key, field.key) === "PROCESS" ? "CLIENT_CONFIRMED" as const : "EXCLUDED" as const,
      legalReview: "NOT_REQUIRED" as const,
      current: true,
    })),
    purpose: input.activityDetails[feature.key]?.purpose,
    retentionPeriod: "",
    lawfulBasis: "待内部确认",
  }));
  const evaluation = evaluateExportInvariants({ scope: {}, activities, commonFacts: [] });
  const plan = buildDraftPlan({
    evaluation,
    assertions: activities.flatMap((activity) => {
      const feature = selectedFeatures.find((item) => item.key === activity.featureKey);
      return activity.assertions.map((assertion) => ({
        ...assertion,
        clauseId: `${activity.activityKey}-${assertion.fieldKey}`,
        evidenceIds: feature?.fields.find((field) => field.key === assertion.fieldKey)?.sourceRefs ?? [],
      }));
    }),
  });
  const generatedDraft = await generatePolicyDraft({
    form: input,
    generationContext,
    contentVersion: verifiedMapV1Content.contentVersion,
    contentHash: verifiedMapV1Content.contentHash,
    knowledgeContext: {
      packageVersion: mapCnKnowledgePackage.contentVersion,
      packageHash: mapCnKnowledgePackage.packageHash,
      ruleSummary: mapCnKnowledgePackage.sources.map((source) => `${source.id}:${source.role}`),
    },
    selectedFeatures: selectedFeatures.map((feature) => ({
      key: feature.key,
      title: feature.title,
      summary: feature.summary,
      fields: feature.fields
        .filter((field) => fieldAnswer(feature.key, field.key) === "PROCESS")
        .map((field) => ({ key: field.key, label: field.label, confirmed: true })),
    })),
    allowedFactKeys: [
      ...selectedFeatures.flatMap((feature) => feature.fields
        .filter((field) => fieldAnswer(feature.key, field.key) === "PROCESS")
        .map((field) => `${feature.key}.${field.key}`)),
      ...input.selected.map((key) => `activityDetails.${key}.purpose`),
      ...Object.keys(input.profile).flatMap((key) => [key, `profile.${key}`]),
      ...confirmedSupplementFactKeys,
      ...verifiedMapV1Content.payload.commonDisclosureFields.map((field) => field.key),
      "additionalNotes",
      ...structuredFactKeys,
      "THIRD_PARTY_FACTS_STATUS",
    ],
    confirmedFactKeys: [
      ...selectedFeatures.flatMap((feature) => feature.fields
        .filter((field) => fieldAnswer(feature.key, field.key) === "PROCESS")
        .map((field) => `${feature.key}.${field.key}`)),
      ...input.selected.map((key) => `activityDetails.${key}.purpose`),
      ...Object.keys(input.profile).flatMap((key) => [key, `profile.${key}`]),
      ...confirmedSupplementFactKeys,
      "additionalNotes",
      ...structuredFactKeys,
      "THIRD_PARTY_FACTS_STATUS",
    ],
    pendingFacts: [],
    legalSearchResults,
    referenceStructure: [
      { id: "collection_and_use", title: "我们如何收集和使用个人信息", summary: "按功能、个人信息、处理目的三列披露。" },
      { id: "third_parties", title: "合作方以及转移、公开个人信息", summary: "仅使用客户确认的 SDK、合作方和数据流。" },
      { id: "rights", title: "管理您的个人信息", summary: "说明法定权利并使用客户填写的操作入口。" },
      { id: "security", title: "我们如何保护个人信息的安全", summary: "只写客户确认的安全措施。" },
      { id: "retention", title: "我们如何存储个人信息", summary: "统一披露存储地点、保存规则和到期处理。" },
      { id: "minors", title: "我们如何保护未成年人", summary: "按客户选择的未成年人处理情形披露。" },
      { id: "updates", title: "隐私政策的查阅和修订", summary: "披露政策入口和更新通知方式。" },
      { id: "contact", title: "联系我们", summary: "披露公司公共联系方式和响应期限。" },
    ],
  }, { onProgress: callbacks.onProgress, signal: callbacks.signal });

  await callbacks.onStage?.("FINALIZING", "正在核对结构并制作 Word");
  const docx = await renderDraftDocx(plan, {
    operatorName: input.profile.operatorName,
    productName: input.profile.productName,
    productVersion: input.profile.productVersion,
    contentVersion: verifiedMapV1Content.contentVersion,
    contentHash: verifiedMapV1Content.contentHash,
    policyEffectiveDate: input.profile.policyEffectiveDate,
    generatedAt: new Date().toISOString().slice(0, 10),
    model: generatedDraft.model,
  }, generatedDraft);
  return {
    filename: `${safeFilename(input.profile.productName)}-隐私政策.docx`,
    markdown: generatedDraft.markdown,
    docx,
    model: generatedDraft.model,
  };
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "隐私政策";
}

function collectFactPaths(value: unknown, prefix: string): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object") return [prefix];
  const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
  const paths: string[] = [];
  for (const [key, child] of entries) {
    paths.push(...collectFactPaths(child, prefix ? `${prefix}.${key}` : String(key)));
  }
  return paths;
}
