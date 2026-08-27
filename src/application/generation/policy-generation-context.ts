import { getSlotScenario } from "@/src/knowledge/map-cn";
import type { ProjectFormData } from "@/src/workspace/contract";
import type { MobilityQuestionnaire } from "@/src/questionnaires/mobility";

export type PolicyGenerationContext = {
  category: {
    key: string;
    label: string;
    basicFunction: string;
    necessaryInfoBaseline: string;
  };
  profile: ProjectFormData["profile"];
  activities: ProjectFormData["processingActivities"];
  permissions: ProjectFormData["permissions"];
  partners: ProjectFormData["partners"];
  storageAndSecurity: ProjectFormData["storageAndSecurity"];
  rightsAndGovernance: ProjectFormData["rightsAndGovernance"];
  confirmedSupplements: ProjectFormData["supplementAnswers"];
  additionalNotes: string;
  confirmedAttachments: Array<Pick<ProjectFormData["attachments"][number], "name" | "kind" | "content" | "truncated">>;
};

/**
 * Produces the only customer-fact object sent to model prompts. Compatibility
 * fields used by deterministic rules stay outside this object, so a fact is
 * never transmitted twice under both legacy and Core v2 paths.
 */
export function buildPolicyGenerationContext(form: ProjectFormData, questionnaire: MobilityQuestionnaire): PolicyGenerationContext {
  return {
    category: {
      key: questionnaire.categoryKey,
      label: questionnaire.categoryLabel,
      basicFunction: questionnaire.basicFunction,
      necessaryInfoBaseline: questionnaire.necessaryInfoSummary,
    },
    profile: removeEmptyStrings(form.profile),
    activities: form.processingActivities,
    permissions: form.permissions,
    partners: form.partners,
    storageAndSecurity: form.storageAndSecurity,
    rightsAndGovernance: form.rightsAndGovernance,
    confirmedSupplements: Object.fromEntries(Object.entries(form.supplementAnswers)
      .filter(([, answer]) => answer.answer !== "UNKNOWN")
      .map(([questionId, answer]) => {
        const confirmedSlots = answer.answer === "YES"
          ? Object.fromEntries(Object.entries(answer.slots ?? {}).filter(([, slot]) => slot.status === "CONFIRMED"))
          : {};
        return [questionId, {
          ...answer,
          detail: answer.answer === "YES" && !getSlotScenario(questionId) ? answer.detail : "",
          slots: confirmedSlots,
        }];
      })),
    additionalNotes: form.additionalNotes,
    confirmedAttachments: form.attachments
      .filter((attachment) => attachment.status === "CONFIRMED")
      .map(({ name, kind, content, truncated }) => ({ name, kind, content, truncated })),
  };
}

function removeEmptyStrings<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => typeof value !== "string" || value.trim().length > 0),
  ) as T;
}
