import { getMobilityQuestionnaire, getQuestionnaireScenarios } from "@/src/questionnaires/mobility";
import { resolveFieldAnswer } from "@/src/knowledge/readiness";
import { FORM_SCHEMA_VERSION, ProjectFormDataSchema, type ProjectFormData } from "@/src/workspace/contract";
import { basicProfileFields, rightsProfileFields, type ProjectData, type StepIndex } from "./workspace-model";

/** Converts UI compatibility state into the single, versioned persistence contract. */
export function toProjectFormData(current: ProjectData): ProjectFormData {
  const questionnaire = getMobilityQuestionnaire(current.categoryKey);
  const scenarios = getQuestionnaireScenarios(current.categoryKey);
  const basicFeatureIds = new Set(questionnaire.features.filter((feature) => feature.kind === "BASIC").map((feature) => feature.key));
  const processingActivities = [
    ...scenarios.filter((scenario) => current.selected.includes(scenario.id)).map((scenario) => ({
      featureKey: scenario.id,
      title: scenario.title,
      kind: (basicFeatureIds.has(scenario.id) ? "BASIC" : "EXTENSION") as "BASIC" | "EXTENSION",
      informationItems: (questionnaire.features.find((item) => item.key === scenario.id)?.fields ?? [])
        .filter((field) => resolveFieldAnswer(current, `${scenario.id}.${field.key}`) === "PROCESS")
        .map((field) => field.label),
      informationOther: current.processingActivities.find((item) => item.featureKey === scenario.id)?.informationOther ?? [],
      purposes: current.activityDetails[scenario.id]?.purpose ? [current.activityDetails[scenario.id].purpose] : [],
      purposeOther: "",
    })),
    ...current.customFeatures.map((feature) => {
      const existing = current.processingActivities.find((item) => item.featureKey === `custom:${feature}`);
      return {
        ...(existing ?? {
          featureKey: `custom:${feature}`,
          title: feature,
          kind: "CUSTOM" as const,
          informationItems: [],
          informationOther: [],
        }),
        purposes: current.customDetails[feature]?.purpose ? [current.customDetails[feature].purpose] : [],
        purposeOther: "",
      };
    }),
  ];
  const rightsAndGovernance = {
    ...current.rightsAndGovernance,
    rightsEntry: current.profile.rightsEntry ?? "",
    responsePeriod: current.profile.rightsResponsePeriod ?? "",
    contactEmail: current.profile.contactEmail ?? "",
    contactPhone: current.profile.contactPhone ?? "",
    policyEntry: current.profile.policyEntry ?? "",
    updateNotices: current.profile.policyUpdateNotice ? [current.profile.policyUpdateNotice] : [],
    minorMode: current.profile.minorProcessing?.includes("不面向") ? "ADULT_ONLY" as const : current.rightsAndGovernance.minorMode,
  };
  return ProjectFormDataSchema.parse({
    schemaVersion: FORM_SCHEMA_VERSION,
    profile: current.profile,
    additionalNotes: current.additionalNotes,
    supplementAnswers: current.supplementAnswers,
    processingActivities,
    permissions: current.permissions,
    partners: current.partners,
    storageAndSecurity: current.storageAndSecurity,
    rightsAndGovernance,
    attachments: current.attachments,
  });
}

/** Returns the earliest incomplete workspace step; step 6 means the form can enter generation. */
export function firstIncompleteFor(project: ProjectData): StepIndex {
  const questionnaire = getMobilityQuestionnaire(project.categoryKey);
  const scenarios = getQuestionnaireScenarios(project.categoryKey);
  const basicFeatureIds = new Set(questionnaire.features.filter((feature) => feature.kind === "BASIC").map((feature) => feature.key));
  const basicComplete = basicProfileFields.every(([key]) => Boolean(project.profile[key]?.trim()));
  if (!basicComplete) return 0;
  const selectedScenarios = scenarios.filter((scenario) => project.selected.includes(scenario.id));
  const detailsComplete = selectedScenarios.every((scenario) => Boolean(project.activityDetails[scenario.id]?.purpose?.trim()))
    && project.customFeatures.every((feature) => Boolean(project.customDetails[feature]?.purpose?.trim()));
  const hasBasicFeature = project.selected.some((feature) => basicFeatureIds.has(feature))
    || project.processingActivities.some((activity) => activity.kind === "BASIC");
  if (!hasBasicFeature || !detailsComplete) return 1;
  const hasProcessedField = selectedScenarios.some((scenario) => {
    const feature = questionnaire.features.find((item) => item.key === scenario.id);
    return (feature?.fields ?? []).some((field, index) => resolveFieldAnswer(project, `${scenario.id}.${field.key}`) === "PROCESS" || resolveFieldAnswer(project, `${scenario.id}.${index}`) === "PROCESS");
  });
  const hasCustomInformation = project.processingActivities.some((activity) => activity.informationItems.length > 0);
  if (!hasProcessedField && !hasCustomInformation) return 1;
  if (!project.supplementAnswers["device-permissions"]) return 2;
  if (!project.supplementAnswers["third-party-services"]) return 3;
  if (!project.supplementAnswers["storage-locations"] || !project.profile.securityMeasures?.trim()) return 4;
  const rightsComplete = rightsProfileFields
    .filter(([key]) => key !== "contactPhone")
    .every(([key]) => Boolean(project.profile[key]?.trim()));
  return rightsComplete ? 6 : 5;
}
