import { appCategories } from "@/src/categories";
import {
  MOBILITY_CATEGORY_KEYS,
  mobilityQuestionnaires,
  type MobilityCategoryKey,
} from "./mobility";
import {
  OTHER_CATEGORY_KEYS,
  otherQuestionnaires,
  type OtherCategoryKey,
} from "./other-categories";

export { MOBILITY_CATEGORY_KEYS, type MobilityCategoryKey } from "./mobility";
export { OTHER_CATEGORY_KEYS, type OtherCategoryKey } from "./other-categories";

export type {
  AppQuestionnaire,
  PermissionPreset,
  QuestionnaireFeature,
  QuestionnaireField,
  QuestionnairePresetFeature,
} from "./shared";

export const APP_CATEGORY_KEYS = [
  ...MOBILITY_CATEGORY_KEYS,
  ...OTHER_CATEGORY_KEYS,
] as const;

export type AppCategoryKey = MobilityCategoryKey | OtherCategoryKey;

const questionnaires = {
  ...mobilityQuestionnaires,
  ...otherQuestionnaires,
} satisfies Record<AppCategoryKey, import("./shared").AppQuestionnaire>;

const configuredKeys = new Set(APP_CATEGORY_KEYS);
const registryKeys = new Set(appCategories.map((category) => category.key));

if (
  APP_CATEGORY_KEYS.length !== 39
  || configuredKeys.size !== 39
  || registryKeys.size !== 39
  || APP_CATEGORY_KEYS.some((key) => !registryKeys.has(key))
) {
  throw new Error("39 类应用配置与问卷注册中心不一致。");
}

export function isAppCategoryKey(value: string): value is AppCategoryKey {
  return configuredKeys.has(value as AppCategoryKey);
}

export function getAppQuestionnaire(categoryKey: string) {
  if (!isAppCategoryKey(categoryKey)) {
    throw new Error(`暂不支持的应用类别：${categoryKey}`);
  }
  return questionnaires[categoryKey];
}

export function getQuestionnaireFeature(categoryKey: string, featureKey: string) {
  return getAppQuestionnaire(categoryKey).features.find((feature) => feature.key === featureKey);
}

export function getQuestionnaireScenarios(categoryKey: string) {
  return getAppQuestionnaire(categoryKey).features.map((feature) => ({
    id: feature.key,
    title: feature.title,
    group: feature.kind === "BASIC" ? "基本功能" : "扩展功能",
    summary: feature.summary,
    fields: feature.fields.map((item) => item.label),
    status: feature.defaultSelection ? "selected" as const : "candidate" as const,
  }));
}
