import { z } from "zod";
import { FormPayloadSchema } from "@/src/ai/form-payload";
import { SupplementAnswerSchema } from "@/src/knowledge/map-cn/schema";

/**
 * 工作区步骤 → URL 段 的唯一权威映射。
 * 客户端侧边栏与 app 路由守卫共用这一份，避免两处手写漂移。
 */
export const WORKSPACE_STEPS = [
  { step: 0, slug: "profile", label: "基本信息" },
  { step: 1, slug: "processing", label: "功能与个人信息" },
  { step: 2, slug: "permissions", label: "设备权限" },
  { step: 3, slug: "partners", label: "SDK 与合作方" },
  { step: 4, slug: "storage", label: "存储与安全" },
  { step: 5, slug: "rights", label: "用户权利" },
  { step: 6, slug: "generate", label: "隐私政策生成" },
] as const;

export type WorkspaceStep = (typeof WORKSPACE_STEPS)[number]["step"];

const slugToStep = new Map<string, WorkspaceStep>(WORKSPACE_STEPS.map((item) => [item.slug, item.step]));

export function parseWorkspaceStep(slug: string): WorkspaceStep | null {
  const step = slugToStep.get(slug);
  return step === undefined ? null : step;
}

export function workspaceSlugFor(step: WorkspaceStep): string {
  return WORKSPACE_STEPS[step].slug;
}

/**
 * 项目表单的运行期“本地细节”字段。它们允许本地水合时挂载，但不属于
 * 提交/校验契约：生成草稿时会重建，旧值重新载入时也应被丢弃。
 */
export const projectLocalExtras = ["generatedMarkdown"] as const;

export const FORM_SCHEMA_VERSION = "privacy-form-v2.0.0" as const;

/**
 * 持久化到 MySQL formData 的 JSON 形状，允许“分步骤保存”的部分数据：
 * - 字段类型与取值空间在写入时校验（坏数据打崩水合端的风险在此拦截）；
 * - 完成度（四项门禁、profile 全量、目的/期限、信息项等）不在这里要求，
 *   由 evaluateFormalPolicyReadiness 用 BLOCKING 诊断统一把关。
 */
export const ProcessingActivitySchema = z.object({
  featureKey: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  kind: z.enum(["BASIC", "EXTENSION", "CUSTOM"]),
  informationItems: z.array(z.string().trim().min(1).max(200)).default([]),
  informationOther: z.array(z.string().trim().min(1).max(200)).default([]),
  purposes: z.array(z.string().trim().min(1).max(500)).default([]),
  purposeOther: z.string().max(1_000).default(""),
}).strict();

export const ProjectFormDataSchema = z.object({
  schemaVersion: z.literal(FORM_SCHEMA_VERSION).default(FORM_SCHEMA_VERSION),
  profile: FormPayloadSchema.shape.profile.partial().default({}),
  additionalNotes: z.string().max(10_000).default(""),
  supplementAnswers: z.record(z.string(), SupplementAnswerSchema).default({}),
  processingActivities: z.array(ProcessingActivitySchema).default([]),
  permissions: z.array(z.object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(200),
    scenes: z.array(z.string().trim().min(1).max(500)).default([]),
    sceneOther: z.string().max(1_000).default(""),
  })).default([]),
  partners: z.array(z.object({
    kind: z.enum(["SDK", "PARTNER"]).default("SDK"),
    name: z.string().trim().min(1).max(200),
    provider: z.string().max(300).default(""),
    purposes: z.array(z.string().max(500)).default([]),
    informationItems: z.array(z.string().max(300)).default([]),
    permissions: z.array(z.string().max(200)).default([]),
    trigger: z.string().max(500).default(""),
    privacyUrl: z.string().max(1_000).default(""),
  })).default([]),
  storageAndSecurity: z.object({
    locations: z.array(z.enum(["CN", "OVERSEAS", "DEVICE", "CLOUD"])).default(["CN"]),
    crossBorderDetail: z.string().max(2_000).default(""),
    retentionPolicies: z.array(z.enum(["MINIMUM_NECESSARY", "FIXED_PERIOD", "UNTIL_DELETION_OR_CLOSURE", "LEGAL_REQUIREMENT"])).default(["MINIMUM_NECESSARY", "LEGAL_REQUIREMENT"]),
    fixedPeriod: z.string().max(500).default(""),
    expiryActions: z.array(z.enum(["DELETE", "ANONYMIZE", "OTHER"])).default(["DELETE", "ANONYMIZE"]),
    expiryOther: z.string().max(1_000).default(""),
    securityMeasures: z.array(z.string().max(300)).default([]),
  }).partial().default({}),
  rightsAndGovernance: z.object({
    rightsEntry: z.string().max(1_000).default(""),
    responsePeriod: z.string().max(500).default(""),
    contactEmail: z.string().max(255).default(""),
    contactPhone: z.string().max(100).default(""),
    policyEntry: z.string().max(1_000).default(""),
    updateNotices: z.array(z.string().max(300)).default([]),
    minorMode: z.enum(["ADULT_ONLY", "MINORS_WITH_GUARDIAN", "CHILD_DIRECTED"]).optional(),
  }).partial().default({}),
  attachments: z.array(z.object({
    id: z.string().max(100),
    name: z.string().max(300),
    kind: z.enum(["DOCUMENT", "SPREADSHEET", "IMAGE", "TEXT"]),
    status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).default("PENDING"),
    mimeType: z.string().max(160).default("application/octet-stream"),
    size: z.number().int().nonnegative().max(20 * 1024 * 1024).default(0),
    content: z.string().max(30_000).default(""),
    truncated: z.boolean().default(false),
  })).max(5).default([]),
}).strict().superRefine((form, context) => {
  const totalAttachmentText = form.attachments?.reduce((total, attachment) => total + attachment.content.length, 0) ?? 0;
  if (totalAttachmentText > 60_000) {
    context.addIssue({ code: "custom", path: ["attachments"], message: "附件可读内容总量超过限制。" });
  }
});

export type ProjectFormData = z.output<typeof ProjectFormDataSchema>;

/** 入库/入哈希前剥离本地细节（如生成预览），避免它污染修订与表单哈希。 */
export function stripProjectLocalExtras<T extends Record<string, unknown>>(form: T): Omit<T, (typeof projectLocalExtras)[number]> {
  const rest = { ...form };
  delete rest.generatedMarkdown;
  return rest;
}

export function calculateProjectProgress(form: Partial<ProjectFormData>): number {
  const profile = form.profile ?? {};
  const profileDone = ["operatorName", "productName", "productVersion", "policyEffectiveDate"].every((key) => Boolean(profile[key as keyof typeof profile]?.trim()));
  const hasActivity = form.processingActivities?.some((item) => (item.informationItems.length > 0 || item.informationOther.length > 0) && (item.purposes.length > 0 || Boolean(item.purposeOther.trim())));
  const permissionsDone = Boolean(form.supplementAnswers?.["device-permissions"]);
  const partnersDone = Boolean(form.supplementAnswers?.["third-party-services"]);
  const storage = form.storageAndSecurity;
  const storageDone = Boolean(
    storage?.locations?.length
    && storage.retentionPolicies?.length
    && storage.expiryActions?.length
    && storage.securityMeasures?.length,
  );
  const rights = form.rightsAndGovernance;
  const rightsDone = Boolean(
    rights?.rightsEntry?.trim()
    && rights.responsePeriod?.trim()
    && rights.contactEmail?.trim()
    && rights.policyEntry?.trim()
    && rights.updateNotices?.length
    && rights.minorMode,
  );
  // 第七环节是生成结果，不能仅凭 formData 判定完成。事实全部填写完时
  // 项目进度为 6/7；报告成功落库后由生成事务推进到 100%。
  const stages = [profileDone, hasActivity, permissionsDone, partnersDone, storageDone, rightsDone];
  return Math.round(stages.filter(Boolean).length / WORKSPACE_STEPS.length * 100);
}
