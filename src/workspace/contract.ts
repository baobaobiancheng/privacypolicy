import { z } from "zod";
import { FormPayloadSchema } from "@/src/ai/deepseek";
import { SupplementAnswerSchema } from "@/src/knowledge/map-cn/schema";

/**
 * 工作区步骤 → URL 段 的唯一权威映射。
 * 客户端侧边栏与 app 路由守卫共用这一份，避免两处手写漂移。
 */
export const WORKSPACE_STEPS = [
  { step: 0, slug: "scope", label: "适用范围" },
  { step: 1, slug: "profile", label: "通用信息" },
  { step: 2, slug: "features", label: "功能与信息" },
  { step: 3, slug: "review", label: "信息选择" },
  { step: 4, slug: "supplement", label: "补充信息" },
  { step: 5, slug: "draft", label: "生成政策" },
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

/**
 * 持久化到 MySQL formData 的 JSON 形状，允许“分步骤保存”的部分数据：
 * - 字段类型与取值空间在写入时校验（坏数据打崩水合端的风险在此拦截）；
 * - 完成度（四项门禁、profile 全量、目的/期限、信息项等）不在这里要求，
 *   由 evaluateFormalPolicyReadiness 用 BLOCKING 诊断统一把关。
 */
export const ProjectFormDataSchema = z.object({
  profile: FormPayloadSchema.shape.profile.partial(),
  selected: z.array(z.string().trim().min(1).max(100)).default([]),
  customFeatures: z.array(z.string().trim().min(1).max(200)).default([]),
  customDetails: z.record(z.string(), z.object({ purpose: z.string().max(1_000).default(""), retention: z.string().max(500).default("") })).default({}),
  activityDetails: z.record(z.string(), z.object({ purpose: z.string().max(1_000).default(""), retention: z.string().max(500).default("") })).default({}),
  confirmedFields: z.array(z.string().trim().min(1).max(160)).default([]),
  fieldAnswers: z.record(z.string(), z.enum(["PROCESS", "NOT_PROCESS"])).default({}),
  additionalNotes: z.string().max(10_000).default(""),
  scopeAnswers: z.record(z.string(), z.boolean()).default({}),
  supplementAnswers: z.record(z.string(), SupplementAnswerSchema).default({}),
  scopeStop: z.string().max(100).optional(),
  generatedMarkdown: z.string().max(500_000).optional(),
}).partial();

export type ProjectFormData = z.output<typeof ProjectFormDataSchema>;

/** 入库/入哈希前剥离本地细节（如生成预览），避免它污染修订与表单哈希。 */
export function stripProjectLocalExtras<T extends Record<string, unknown>>(form: T): Omit<T, (typeof projectLocalExtras)[number]> {
  const { generatedMarkdown: _generatedMarkdown, ...rest } = form;
  return rest;
}
