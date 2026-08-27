import { z } from "zod";
import type { PolicyGenerationContext } from "@/src/application/generation/policy-generation-context";
import { getMobilityQuestionnaire, getQuestionnaireFeature } from "@/src/questionnaires/mobility";
import { DomainError } from "@/src/domain/errors";
import { sanitizeConfirmedForm } from "./confirmed-form";
import { configuredDeepSeekModel } from "./deepseek-config";
import { requestDeepSeekCompletion } from "./deepseek-client";
import type { FormPayload } from "./form-payload";
import { normalizeJsonModelOutput } from "./model-output";

const PREFLIGHT_MAX_TOKENS = 8_192;

export const PreflightIssueSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/),
  severity: z.enum(["BLOCKING", "WARNING"]),
  category: z.enum(["CONTRADICTION", "THIRD_PARTY", "INCOMPLETE", "IMPLAUSIBLE", "CLARITY"]),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(4).max(600),
  targetStep: z.enum(["profile", "features", "review", "supplement"]),
  relatedPaths: z.array(z.string().trim().min(1).max(180)).max(12),
  questionForUser: z.string().trim().min(2).max(300),
}).strict();

export const GenerationPreflightSchema = z.object({
  issues: z.array(PreflightIssueSchema).max(20),
  lawKeywords: z.array(z.string().trim().min(2).max(40)).min(1).max(5),
}).strict();

export type PreflightIssue = z.infer<typeof PreflightIssueSchema>;
export type GenerationPreflight = z.infer<typeof GenerationPreflightSchema>;

/**
 * Flexible semantic preflight: the model may expose contradictions and
 * implausible third-party facts, but it cannot rewrite or confirm user data.
 */
export async function analyzeFormBeforeGeneration(
  form: FormPayload,
  signal?: AbortSignal,
  generationContext?: PolicyGenerationContext,
  categoryKey = "map-navigation",
): Promise<GenerationPreflight> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new DomainError("MODEL_NOT_CONFIGURED", "尚未配置 DeepSeek API Key，无法执行生成前检查。", { retryable: false });
  const confirmedForm = sanitizeConfirmedForm(form);
  const semanticFeatureMap = confirmedForm.selected.map((featureKey) => {
    const feature = getQuestionnaireFeature(categoryKey, featureKey);
    return {
      featureKey,
      title: feature?.title ?? featureKey,
      informationDecisions: feature?.fields.map((field, index) => ({
        fieldKey: field.key,
        label: field.label,
        decision: confirmedForm.fieldAnswers?.[`${featureKey}.${field.key}`]
          ?? (confirmedForm.confirmedFields.includes(`${featureKey}.${field.key}`) ? "PROCESS"
            : confirmedForm.fieldAnswers?.[`${featureKey}.${index}`]
              ?? (confirmedForm.confirmedFields.includes(`${featureKey}.${index}`) ? "PROCESS" : "NOT_SELECTED")),
      })) ?? [],
    };
  });
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    {
      role: "system",
      content: [
        "你是隐私政策生成前的产品事实审查器，不作最终合规结论，也不修改客户答案。",
        "只输出JSON对象，不要Markdown或解释。",
        "识别跨字段自相矛盾、同一信息保存期限冲突、明显复制错场景的目的、第三方名称/提供方/链接不协调、示例值或占位内容、无法支撑清晰政策的关键缺口。",
        "不同信息类型或不同处理场景可以采用不同保存期限：例如客服记录、请求日志、安全日志、崩溃日志和脱敏定位日志不是同一类记录。只有同一信息、同一场景出现互不相容的期限才算冲突；用户可依法申请删除与系统设置一般保存期限并不矛盾。",
        "只有明确会导致政策陈述错误或无法使用的问题标为BLOCKING；表达优化建议标为WARNING，避免把合理的产品差异当成错误。明显示例值/占位符、第三方链接与提供方不匹配、把同一目的或期限复制给语义完全不同的处理活动，均应标为BLOCKING。",
        "不得仅因同类产品通常使用某项SDK、存储或功能，就把客户明确回答NO判为错误；没有客户输入证据时最多给WARNING。用户权利入口提到可删除某类信息，也不当然证明本产品实际保存了该类信息。",
        "日期判断必须以CURRENT_DATE为准，不得使用模型记忆中的当前日期。",
        "政策生效日期与CURRENT_DATE相同是正常情况，不得仅以同日生效为由判断成占位符。",
        "relatedPaths必须使用FORM_JSON中的字段路径；不得编造客户事实。",
        "description和questionForUser必须面向非技术客户，使用自然语言，不得出现任何FORM_JSON字段路径、代码标识符或内部字段名（例如不得写 supplementAnswers.storage-locations、profile.contactEmail 这类路径）；可以引用“客服记录的保存期限”“存储位置说明”“隐私联系邮箱”等客户能理解的说法。relatedPaths仍然必须包含精确字段路径，供系统定位。",
        "同时给出1至5个适合中国现行法规快捷关键词检索的短关键词。关键词应直接对应本项目实际场景，优先使用法规名称或法律主题，不要写完整问题。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "PRODUCT_CATEGORY:", JSON.stringify(getMobilityQuestionnaire(categoryKey).categoryLabel),
        "FORM_JSON:", JSON.stringify(generationContext ?? confirmedForm),
        "SEMANTIC_FEATURE_MAP:", JSON.stringify(semanticFeatureMap),
        "CURRENT_DATE:", new Date().toISOString().slice(0, 10),
        "OUTPUT_SCHEMA:", JSON.stringify({
          issues: [{ id: "retention-conflict", severity: "BLOCKING|WARNING", category: "CONTRADICTION|THIRD_PARTY|INCOMPLETE|IMPLAUSIBLE|CLARITY", title: "string", description: "string", targetStep: "profile|features|review|supplement", relatedPaths: ["path"], questionForUser: "string" }],
          lawKeywords: ["个人信息保护法 敏感个人信息"],
        }),
      ].join("\n"),
    },
  ];
  const response = await requestDeepSeekCompletion({
    apiKey,
    model: configuredDeepSeekModel(),
    messages,
    maxTokens: PREFLIGHT_MAX_TOKENS,
    temperature: 0,
    thinking: false,
    signal,
  });
  const raw = normalizeJsonModelOutput(response.choices[0]?.message.content);
  try {
    return GenerationPreflightSchema.parse(JSON.parse(raw));
  } catch {
    throw new DomainError("MODEL_OUTPUT_INVALID", "生成前检查结果无法识别，请重新检查。", { retryable: true });
  }
}
