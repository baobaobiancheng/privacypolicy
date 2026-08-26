import { z } from "zod";
import { SupplementAnswerSchema } from "@/src/knowledge/map-cn/schema";

export const FormPayloadSchema = z.object({
  profile: z.object({
    operatorName: z.string().trim().min(1).max(200),
    operatorContact: z.string().trim().min(1).max(500),
    productName: z.string().trim().min(1).max(200),
    platform: z.string().trim().max(100).optional().default(""),
    productVersion: z.string().trim().min(1).max(100),
    releaseDate: z.string().trim().max(100).optional().default(""),
    contactEmail: z.string().trim().min(1).max(255),
    contactPhone: z.string().trim().max(100).optional().default(""),
    rightsEntry: z.string().trim().min(1).max(500),
    rightsResponsePeriod: z.string().trim().min(1).max(500),
    policyEntry: z.string().trim().max(1_000).optional().default(""),
    minorProcessing: z.string().trim().min(1).max(1_000),
    securityMeasures: z.string().trim().min(1).max(1_000),
    incidentChannel: z.string().trim().min(1).max(500),
    policyEffectiveDate: z.string().trim().min(1).max(100),
    policyUpdateNotice: z.string().trim().min(1).max(500),
  }),
  selected: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  customFeatures: z.array(z.string().trim().min(1).max(200)).max(20),
  customDetails: z.record(z.string(), z.object({ purpose: z.string().trim().min(1).max(1_000) })),
  activityDetails: z.record(z.string(), z.object({ purpose: z.string().trim().min(1).max(1_000) })),
  confirmedFields: z.array(z.string().trim().min(1).max(160)),
  fieldAnswers: z.record(z.string(), z.enum(["PROCESS", "NOT_PROCESS"])).default({}),
  additionalNotes: z.string().max(10_000),
  supplementAnswers: z.record(z.string(), SupplementAnswerSchema).default({}),
});

/** Input type intentionally preserves optional defaults for older persisted forms. */
export type FormPayload = z.input<typeof FormPayloadSchema>;
