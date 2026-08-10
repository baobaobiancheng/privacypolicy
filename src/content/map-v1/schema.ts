import { z } from "zod";

const StableKey = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/, "必须是稳定的小写字段键");
const SourceRef = z.string().min(1);

export const ScopeGateSchema = z.object({
  id: StableKey,
  label: z.string().min(1),
  blockingCode: z.literal("SCOPE_NOT_SUPPORTED"),
}).strict();

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["REGULATION", "EXPERT_CONTENT", "REFERENCE_POLICY"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  url: z.string().url().optional(),
}).strict();

export const FeatureFieldSchema = z.object({
  key: StableKey,
  label: z.string().min(1),
  dataClass: z.enum(["LOCATION", "USAGE_METADATA", "DEVICE", "LOG", "CONTACT", "IDENTIFIER", "COMMUNICATION", "CONTENT", "NETWORK"]),
  required: z.boolean(),
  sourceRefs: z.array(SourceRef).min(1),
}).strict();

export const FeatureSchema = z.object({
  key: StableKey,
  title: z.string().min(1),
  group: z.string().min(1),
  summary: z.string().min(1),
  sourceRefs: z.array(SourceRef).min(1),
  defaultSelection: z.boolean(),
  riskCode: z.string().min(1).nullable(),
  fields: z.array(FeatureFieldSchema).min(1),
}).strict();

export const CommonDisclosureFieldSchema = z.object({
  key: StableKey,
  label: z.string().min(1),
  required: z.boolean(),
  group: z.enum(["organization", "product", "rights", "minor", "security", "incident", "policy"]),
}).strict();

export const ReviewNoteSchema = z.object({
  role: z.string().min(1),
  quote: z.string().min(1),
}).strict();

export const MapPayloadSchema = z.object({
  category: z.literal("地图导航类"),
  scopeGates: z.array(ScopeGateSchema).length(4),
  evidence: z.array(EvidenceSchema).min(3),
  features: z.array(FeatureSchema).length(5),
  commonDisclosureFields: z.array(CommonDisclosureFieldSchema).min(1),
  reviewNotes: z.array(ReviewNoteSchema).length(3),
}).strict();

export const ContentEnvelopeSchema = z.object({
  schemaVersion: z.literal("1"),
  contentVersion: z.string().regex(/^map-v1\.\d+\.\d+$/),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  publishedAt: z.string().datetime(),
  payload: MapPayloadSchema,
}).strict();

export type MapPayload = z.infer<typeof MapPayloadSchema>;
export type MapV1Content = z.infer<typeof ContentEnvelopeSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type FeatureField = z.infer<typeof FeatureFieldSchema>;

export function validateReferences(content: MapV1Content): MapV1Content {
  const evidenceIds = new Set(content.payload.evidence.map((item) => item.id));
  const referencedIds = content.payload.features.flatMap((feature) => [
    ...feature.sourceRefs,
    ...feature.fields.flatMap((field) => field.sourceRefs),
  ]);

  const missing = [...new Set(referencedIds.filter((ref) => !evidenceIds.has(ref)))];
  if (missing.length > 0) {
    throw new Error(`CONTENT_REFERENCE_INVALID:${missing.join(",")}`);
  }

  const featureKeys = content.payload.features.map((feature) => feature.key);
  if (new Set(featureKeys).size !== featureKeys.length) {
    throw new Error("CONTENT_DUPLICATE_FEATURE_KEY");
  }

  const fieldKeys = content.payload.features.flatMap((feature) => feature.fields.map((field) => `${feature.key}.${field.key}`));
  if (new Set(fieldKeys).size !== fieldKeys.length) {
    throw new Error("CONTENT_DUPLICATE_FIELD_KEY");
  }

  const gateIds = content.payload.scopeGates.map((gate) => gate.id);
  if (new Set(gateIds).size !== gateIds.length) {
    throw new Error("CONTENT_DUPLICATE_SCOPE_GATE");
  }

  return content;
}
