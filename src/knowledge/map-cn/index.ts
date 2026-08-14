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

export function getRequiredSupplementQuestions(input: { selected: string[]; customFeatures: string[]; supplementAnswers?: Record<string, SupplementAnswer> }) {
  return mapCnKnowledgePackage.questions.filter((question) => isQuestionRequired(question, input));
}
