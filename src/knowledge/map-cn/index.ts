import rawPackage from "./map-cn-v1.1.0.json";
import rawSlotPackage from "./map-slot-v1.0.0.json";
import { MapKnowledgePackageSchema, MapSlotPackageSchema, type KnowledgeQuestion, type MapKnowledgePackage } from "./schema";
import type { SupplementAnswer } from "./schema";

export const mapCnKnowledgePackage: MapKnowledgePackage = MapKnowledgePackageSchema.parse(rawPackage);
export const mapSlotPackage = MapSlotPackageSchema.parse(rawSlotPackage);

export function getSlotScenario(questionId: string) {
  return mapSlotPackage.scenarios.find((scenario) => scenario.questionId === questionId);
}

/** Runtime DTO intentionally contains no competitor names, sourceRefs, URLs or excerpts. */
export function getRuntimeSlotScenario(questionId: string) {
  const scenario = getSlotScenario(questionId);
  if (!scenario) return undefined;
  return {
    scenarioId: scenario.scenarioId,
    questionId: scenario.questionId,
    title: scenario.title,
    slots: scenario.slots.map(({ id, label, prompt, inputType, required }) => ({ id, label, prompt, inputType, required })),
  };
}

export function isQuestionRequired(question: KnowledgeQuestion, input: { selected: string[]; customFeatures: string[]; supplementAnswers?: Record<string, SupplementAnswer> }) {
  const requirement = question.requiredWhen;
  const sceneMatches = requirement.always === true
    || (requirement.hasCustomFeature === true && input.customFeatures.length > 0)
    || Boolean(requirement.selectedAny?.some((feature) => input.selected.includes(feature)));
  if (!sceneMatches) return false;
  if (!question.dependsOn) return true;
  return input.supplementAnswers?.[question.dependsOn.questionId]?.answer === question.dependsOn.answer;
}

export function getRequiredSupplementQuestions(
  input: { selected: string[]; customFeatures: string[]; supplementAnswers?: Record<string, SupplementAnswer> },
  categoryKey = "map-navigation",
) {
  const normalizedInput = categoryKey === "map-navigation" ? input : normalizeCommonFeatureTriggers(input);
  return mapCnKnowledgePackage.questions
    .filter((question) => isQuestionRequired(question, normalizedInput))
    .map((question) => categoryKey === "map-navigation" ? question : generalizeQuestionCopy(question));
}

function normalizeCommonFeatureTriggers(input: { selected: string[]; customFeatures: string[]; supplementAnswers?: Record<string, SupplementAnswer> }) {
  const selected = new Set(input.selected);
  if (input.customFeatures.includes("客服与问题反馈")) selected.add("support");
  if (input.customFeatures.includes("安全保障与故障诊断")) selected.add("security");
  if (input.customFeatures.includes("个性化展示与推荐")) selected.add("discovery");
  return { ...input, selected: [...selected] };
}

function generalizeQuestionCopy(question: KnowledgeQuestion): KnowledgeQuestion {
  if (question.id === "third-party-services") {
    return { ...question, prompt: "产品是否使用 SDK、云服务、统计、推送或其他第三方服务？" };
  }
  if (question.id === "notification-push") {
    return { ...question, prompt: "产品是否发送订单、行程或服务提醒、运营消息或营销推送？" };
  }
  return question;
}
