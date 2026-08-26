import { z } from "zod";
import { FormPayloadSchema } from "@/src/ai/form-payload";
import { GenerationPreflightSchema } from "@/src/ai/policy-preflight";
import { getMapFeature } from "@/src/content/map-v1";
import { FORM_SCHEMA_VERSION, ProjectFormDataSchema, type ProjectFormData } from "./contract";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

/**
 * One-way compatibility adapter for local development data. Old workspace keys
 * are read once and converted into the canonical v2 contract. Every subsequent
 * save writes only v2 JSON, so legacy fields cannot become a second fact source.
 */
export function canonicalizeProjectFormData(value: unknown): ProjectFormData {
  const parsed = ProjectFormDataSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  const legacy = asRecord(value);
  const migrated = {
    schemaVersion: FORM_SCHEMA_VERSION,
    profile: asRecord(legacy.profile),
    processingActivities: Array.isArray(legacy.processingActivities) ? legacy.processingActivities : [],
    permissions: Array.isArray(legacy.permissions) ? legacy.permissions : [],
    partners: Array.isArray(legacy.partners) ? legacy.partners : [],
    storageAndSecurity: asRecord(legacy.storageAndSecurity),
    rightsAndGovernance: asRecord(legacy.rightsAndGovernance),
    supplementAnswers: asRecord(legacy.supplementAnswers),
    additionalNotes: typeof legacy.additionalNotes === "string" ? legacy.additionalNotes : "",
    attachments: Array.isArray(legacy.attachments) ? legacy.attachments : [],
  };
  return ProjectFormDataSchema.parse(migrated);
}

export function toGenerationForm(formData: ProjectFormData): z.output<typeof FormPayloadSchema> {
  const selected = formData.processingActivities
    .filter((activity) => activity.kind !== "CUSTOM")
    .map((activity) => activity.featureKey);
  const customFeatures = formData.processingActivities
    .filter((activity) => activity.kind === "CUSTOM")
    .map((activity) => activity.title);
  const activityDetails = Object.fromEntries(
    formData.processingActivities
      .filter((activity) => activity.kind !== "CUSTOM")
      .map((activity) => [activity.featureKey, {
        purpose: [...activity.purposes, activity.purposeOther].filter(Boolean).join("；"),
      }]),
  );
  const customDetails = Object.fromEntries(
    formData.processingActivities
      .filter((activity) => activity.kind === "CUSTOM")
      .map((activity) => [activity.title, {
        purpose: [...activity.purposes, activity.purposeOther].filter(Boolean).join("；"),
      }]),
  );

  const confirmedFields: string[] = [];
  const fieldAnswers: Record<string, "PROCESS" | "NOT_PROCESS"> = {};
  for (const activity of formData.processingActivities) {
    const feature = getMapFeature(activity.featureKey);
    for (const field of feature?.fields ?? []) {
      const assertionKey = `${activity.featureKey}.${field.key}`;
      const processed = activity.informationItems.includes(field.label);
      fieldAnswers[assertionKey] = processed ? "PROCESS" : "NOT_PROCESS";
      if (processed) confirmedFields.push(assertionKey);
    }
  }

  return FormPayloadSchema.parse({
    profile: formData.profile,
    selected,
    customFeatures,
    customDetails,
    activityDetails,
    confirmedFields,
    fieldAnswers,
    additionalNotes: formData.additionalNotes,
    supplementAnswers: formData.supplementAnswers,
  });
}

export function toWorkspaceCompatibilityState(formData: ProjectFormData) {
  const selected = formData.processingActivities.filter((item) => item.kind !== "CUSTOM").map((item) => item.featureKey);
  const customActivities = formData.processingActivities.filter((item) => item.kind === "CUSTOM");
  const customFeatures = customActivities.map((item) => item.title);
  const activityDetails = Object.fromEntries(formData.processingActivities
    .filter((item) => item.kind !== "CUSTOM")
    .map((item) => [item.featureKey, { purpose: [...item.purposes, item.purposeOther].filter(Boolean).join("；") }]));
  const customDetails = Object.fromEntries(customActivities
    .map((item) => [item.title, { purpose: [...item.purposes, item.purposeOther].filter(Boolean).join("；") }]));
  const fieldAnswers: Record<string, "PROCESS" | "NOT_PROCESS"> = {};
  const confirmedFields: string[] = [];
  for (const activity of formData.processingActivities) {
    for (const field of getMapFeature(activity.featureKey)?.fields ?? []) {
      const key = `${activity.featureKey}.${field.key}`;
      const processed = activity.informationItems.includes(field.label);
      fieldAnswers[key] = processed ? "PROCESS" : "NOT_PROCESS";
      if (processed) confirmedFields.push(key);
    }
  }
  return {
    ...formData,
    selected,
    customFeatures,
    customDetails,
    activityDetails,
    fieldAnswers,
    confirmedFields,
  };
}

export const GenerationInputSchema = z.object({
  schemaVersion: z.literal(FORM_SCHEMA_VERSION),
  projectRevision: z.number().int().nonnegative(),
  formData: ProjectFormDataSchema,
  acknowledgedPreflightIssues: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
  preflightRound: z.number().int().min(1).max(3).default(1),
  cachedPreflight: GenerationPreflightSchema.optional(),
}).strict();

export type GenerationInput = z.output<typeof GenerationInputSchema>;
