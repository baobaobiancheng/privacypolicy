import rawPackage from "./map-cn-v1.0.0.json";
import { MapKnowledgePackageSchema, type KnowledgeQuestion, type MapKnowledgePackage } from "./schema";

export const mapCnKnowledgePackage: MapKnowledgePackage = MapKnowledgePackageSchema.parse(rawPackage);

export function isQuestionRequired(question: KnowledgeQuestion, input: { selected: string[]; customFeatures: string[] }) {
  const requirement = question.requiredWhen;
  return requirement.always === true
    || (requirement.hasCustomFeature === true && input.customFeatures.length > 0)
    || Boolean(requirement.selectedAny?.some((feature) => input.selected.includes(feature)));
}

export function getRequiredSupplementQuestions(input: { selected: string[]; customFeatures: string[] }) {
  return mapCnKnowledgePackage.questions.filter((question) => isQuestionRequired(question, input));
}
