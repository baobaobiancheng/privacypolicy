import rawPackage from "./map-cn-v1.1.0.json";
import { MapKnowledgePackageSchema, type KnowledgeQuestion, type MapKnowledgePackage } from "./schema";
import type { SupplementAnswer } from "./schema";

export const mapCnKnowledgePackage: MapKnowledgePackage = MapKnowledgePackageSchema.parse(rawPackage);

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
