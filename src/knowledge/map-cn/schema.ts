import { z } from "zod";

const StableId = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);

const RequirementSchema = z.object({
  always: z.boolean().optional(),
  selectedAny: z.array(StableId).min(1).optional(),
  hasCustomFeature: z.boolean().optional(),
}).strict().refine((value) => Boolean(value.always || value.selectedAny?.length || value.hasCustomFeature), "至少定义一个触发条件");

const AnswerDependencySchema = z.object({
  questionId: StableId,
  answer: z.enum(["YES", "NO"]),
}).strict();

export const SupplementAnswerSchema = z.object({
  answer: z.enum(["YES", "NO", "UNKNOWN"]),
  detail: z.string().trim().max(4_000).default(""),
  slots: z.record(StableId, z.object({
    value: z.string().trim().max(2_000),
    status: z.enum(["CANDIDATE", "CONFIRMED"]),
    evidenceText: z.string().trim().max(2_000).optional(),
    updatedAt: z.string().datetime().optional(),
  }).strict()).default({}),
  updatedAt: z.string().datetime().optional(),
}).strict();

export const SlotDefinitionSchema = z.object({
  id: StableId,
  label: z.string().min(1),
  prompt: z.string().min(1),
  inputType: z.enum(["text", "textarea", "url"]),
  required: z.boolean(),
}).strict();

export const SlotScenarioSchema = z.object({
  scenarioId: StableId,
  questionId: StableId,
  title: z.string().min(1),
  status: z.literal("PUBLISHED"),
  sourceRefs: z.array(z.string().min(1)).min(1),
  slots: z.array(SlotDefinitionSchema).min(1),
}).strict();

export const MapSlotPackageSchema = z.object({
  schemaVersion: z.literal("1"),
  contentVersion: z.string().regex(/^map-slot-v1\.\d+\.\d+$/),
  publishedAt: z.string().datetime(),
  scenarios: z.array(SlotScenarioSchema).length(5),
}).strict();

export const KnowledgeQuestionSchema = z.object({
  id: StableId,
  round: z.number().int().min(1).max(3),
  domain: z.enum(["DATA_FLOW", "PERMISSION", "STORAGE", "THIRD_PARTY", "USER_CONTROL", "SECURITY", "SPECIAL_SCENE"]),
  title: z.string().min(1),
  prompt: z.string().min(1),
  help: z.string().min(1),
  requiredWhen: RequirementSchema,
  yesDetailLabel: z.string().min(1),
  unknownMessage: z.string().min(1),
  riskCode: z.string().min(1),
  dependsOn: AnswerDependencySchema.optional(),
}).strict();

export const MapKnowledgePackageSchema = z.object({
  schemaVersion: z.literal("1"),
  contentVersion: z.string().regex(/^map-cn-v1\.\d+\.\d+$/),
  packageHash: z.string().regex(/^sha256:(?:[a-f0-9]{64}|__GENERATED__)$/),
  publishedAt: z.string().datetime(),
  category: z.literal("地图导航类"),
  sources: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), role: z.string().min(1), url: z.string().url().optional() }).strict()).min(9),
  questions: z.array(KnowledgeQuestionSchema).min(1),
}).strict();

export type SupplementAnswer = z.infer<typeof SupplementAnswerSchema>;
export type SupplementSlot = SupplementAnswer["slots"][string];
export type SlotDefinition = z.infer<typeof SlotDefinitionSchema>;
export type SlotScenario = z.infer<typeof SlotScenarioSchema>;
export type MapSlotPackage = z.infer<typeof MapSlotPackageSchema>;
export type KnowledgeQuestion = z.infer<typeof KnowledgeQuestionSchema>;
export type MapKnowledgePackage = z.infer<typeof MapKnowledgePackageSchema>;
