import { z } from "zod";
import { DomainError } from "@/src/domain/errors";

export const POLICY_SECTION_IDS = [
  "collection_and_use",
  "third_parties",
  "rights",
  "security",
  "retention",
  "minors",
  "updates",
  "contact",
] as const;

export const POLICY_SECTION_TITLES = [
  "我们如何收集和使用个人信息",
  "合作方以及转移、公开个人信息",
  "管理您的个人信息",
  "我们如何保护个人信息的安全",
  "我们如何存储个人信息",
  "我们如何保护未成年人",
  "隐私政策的查阅和修订",
  "联系我们",
] as const;

export const ModelMarkdownSchema = z.string().trim().min(100).max(120_000);

export type MarkdownOpenItem = { assertionId: string; reason: string };
export type GeneratedPolicyDraft = {
  markdown: string;
  model: string;
  assertionIds: string[];
  openItems: MarkdownOpenItem[];
  unmatchedReferences: string[];
};

export type PolicyGenerationProgress = {
  previewMarkdown: string;
  completedSections: number;
  totalSections: number;
  currentSection: string;
  characterCount: number;
  phase: "THINKING" | "WRITING" | "VALIDATED";
  activityCount: number;
};

export function safeStreamingPreview(rawMarkdown: string): PolicyGenerationProgress {
  const withoutFences = rawMarkdown
    .replace(/^\s*```(?:markdown|md)?\s*\n/i, "")
    .replace(/\n?<!--[\s\S]*?-->/g, "\n")
    .replace(/\n?<!--[\s\S]*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const numberedSections = [...withoutFences.matchAll(/^##\s+(\d+)\.\s+(.+?)\s*$/gm)];
  const appendix = /^##\s+附录：名词解释\s*$/m.test(withoutFences);
  const startedSections = numberedSections.length + (appendix ? 1 : 0);
  return {
    previewMarkdown: withoutFences,
    completedSections: Math.max(0, startedSections - 1),
    totalSections: POLICY_SECTION_TITLES.length + 1,
    currentSection: appendix ? "名词解释" : numberedSections.at(-1)?.[2]?.trim() || "正在组织文档结构",
    characterCount: withoutFences.replace(/\s|[#*|`>-]/g, "").length,
    phase: "WRITING",
    activityCount: 0,
  };
}

export function normalizeMarkdown(content: string | Array<{ text?: string }> | null | undefined): string {
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => part.text || "").join("") : "";
  return text.replace(/^\s*```(?:markdown|md)?\s*\n/i, "").replace(/\n\s*```\s*$/i, "").trim();
}

export function validateRequiredPolicyTables(markdown: string, requiresThirdPartyTable: boolean) {
  const tableSeparators = [...markdown.matchAll(/^\|(?:\s*:?-{3,}:?\s*\|){2,}\s*$/gm)];
  const requiredCount = requiresThirdPartyTable ? 2 : 1;
  if (tableSeparators.length < requiredCount) {
    throw new DomainError("MODEL_OUTPUT_INVALID", requiresThirdPartyTable
      ? "生成内容缺少处理活动总表或第三方服务表，请重新生成。"
      : "生成内容缺少处理活动总表，请重新生成。", { retryable: true });
  }
}

export function parsePolicyMarkdown(
  markdown: string,
  allowedFactKeys: Set<string>,
  pendingFacts: Array<{ key: string; label: string }> = [],
  confirmedSourceText = "",
  options: { allowThirdPartyDenial?: boolean } = {},
): Omit<GeneratedPolicyDraft, "model"> {
  const parsed = ModelMarkdownSchema.safeParse(markdown);
  if (!parsed.success) throw new DomainError("MODEL_OUTPUT_INVALID", "DeepSeek 返回的 Markdown 内容为空或过长。", { retryable: true });

  const headings = [...parsed.data.matchAll(/^##\s+(\d+)\.\s+(.+?)\s*$/gm)];
  const headingNumbers = headings.map((match) => Number(match[1]));
  const headingTitles = headings.map((match) => match[2].trim());
  if (headingNumbers.length !== POLICY_SECTION_TITLES.length || headingNumbers.some((number, index) => number !== index + 1)) {
    throw new DomainError("MODEL_OUTPUT_INVALID", `DeepSeek 返回的 Markdown 未覆盖完整的 ${POLICY_SECTION_TITLES.length} 个政策章节。`, { retryable: true });
  }
  const normalizeTitle = (title: string) => title.replace(/[\s，。、（）()「」【】"'":：;；,./]/g, "");
  for (let index = 0; index < POLICY_SECTION_TITLES.length; index += 1) {
    if (!normalizeTitle(headingTitles[index]).includes(normalizeTitle(POLICY_SECTION_TITLES[index]))) {
      throw new DomainError("MODEL_OUTPUT_INVALID", `DeepSeek 返回的第 ${index + 1} 个章节标题不符合约定，应为「${POLICY_SECTION_TITLES[index]}」。`, { retryable: true });
    }
  }

  const firstChapterStart = headings[0]?.index ?? 0;
  const secondChapterStart = headings[1]?.index ?? parsed.data.length;
  const firstChapter = parsed.data.slice(firstChapterStart, secondChapterStart);
  const tableHeader = firstChapter.split("\n").find((line) => /^\s*\|.+\|\s*$/.test(line));
  const columns = tableHeader?.split("|").map((item) => item.trim()).filter(Boolean) ?? [];
  if (columns.length !== 3 || columns[0] !== "功能" || columns[1] !== "个人信息" || columns[2] !== "处理目的") {
    throw new DomainError("MODEL_OUTPUT_INVALID", "隐私政策第一章未使用规定的三列表格（功能、个人信息、处理目的）。", { retryable: true });
  }

  const customerVisibleText = parsed.data.replace(/<!--[\s\S]*?-->/g, "");
  if (/(?:高德地图|百度地图|律师整理|LAWYER-|REFERENCE-|REG-map-|contentHash|contentVersion)/i.test(customerVisibleText)) {
    throw new DomainError("MODEL_OUTPUT_INVALID", "生成结果包含参考产品或内部来源标识。", { retryable: true });
  }

  const assertionIds: string[] = [];
  const unmatchedReferences: string[] = [];
  const assertionComments = [...parsed.data.matchAll(/<!--\s*assertions:\s*([^>]*?)\s*-->/gi)];
  for (const comment of assertionComments) {
    const ids = comment[1].split(",").map((item) => item.trim()).filter(Boolean);
    const commentStart = comment.index ?? 0;
    const previousCommentEnd = parsed.data.lastIndexOf("-->", Math.max(0, commentStart - 1));
    const paragraph = parsed.data.slice(previousCommentEnd >= 0 ? previousCommentEnd + 3 : 0, commentStart);
    for (const id of ids) {
      if (!allowedFactKeys.has(id)) {
        if (!unmatchedReferences.includes(id)) unmatchedReferences.push(id);
        continue;
      }
      const pendingFact = pendingFacts.find((fact) => fact.key === id);
      if (pendingFact && !paragraph.includes(`[[待确认:${id}]]`) && !paragraph.includes(`[[待确认:${pendingFact.label}]]`)) {
        throw new DomainError("MODEL_OUTPUT_INVALID", `DeepSeek 将未确认字段「${id}」写成了确定事实。`, { retryable: true });
      }
      if (!assertionIds.includes(id)) assertionIds.push(id);
    }
  }

  const visibleBlocks = parsed.data.replace(/<!--[\s\S]*?-->/g, "").split(/\n\s*\n/).filter((block) => !block.trim().startsWith("#"));
  for (const fact of pendingFacts) {
    for (const block of visibleBlocks) {
      if (block.includes(fact.label) && !block.includes(`[[待确认:${fact.key}]]`) && !block.includes(`[[待确认:${fact.label}]]`)) {
        throw new DomainError("MODEL_OUTPUT_INVALID", `DeepSeek 未使用占位符披露待确认字段「${fact.key}」。`, { retryable: true });
      }
    }
  }

  const allowedPlaceholders = new Set(pendingFacts.flatMap((fact) => [fact.key, fact.label]));
  const placeholders = [...parsed.data.matchAll(/\[\[待确认:([^\]]+)\]\]/g)].map((match) => match[1].trim());
  const unexpectedPlaceholder = placeholders.find((placeholder) => !allowedPlaceholders.has(placeholder));
  if (unexpectedPlaceholder) {
    throw new DomainError("MODEL_OUTPUT_INVALID", `生成结果将已填写或未配置内容误标为待确认：${unexpectedPlaceholder}`, { retryable: true });
  }

  const negativeThirdPartyPromise = /(?:不会|不再?|绝不)(?:向任何|向)?第三方(?:共享|提供|披露|出售|转让)|不会出售|绝不(?:共享|出售)/;
  if (negativeThirdPartyPromise.test(parsed.data) && !options.allowThirdPartyDenial && !negativeThirdPartyPromise.test(confirmedSourceText)) {
    throw new DomainError("MODEL_OUTPUT_INVALID", "DeepSeek 生成了客户未确认的第三方否定承诺。", { retryable: true });
  }

  const openItems: MarkdownOpenItem[] = [];
  const openItemComments = [...parsed.data.matchAll(/<!--\s*open-item:\s*([^|>]+?)\s*\|\s*([^>]+?)\s*-->/gi)];
  for (const comment of openItemComments) {
    const assertionId = comment[1].trim();
    if (!allowedFactKeys.has(assertionId)) {
      if (!unmatchedReferences.includes(assertionId)) unmatchedReferences.push(assertionId);
      continue;
    }
    openItems.push({ assertionId, reason: comment[2].trim() });
  }
  if (unmatchedReferences.length > 0) {
    throw new DomainError("MODEL_OUTPUT_INVALID", `生成内容引用了未授权的事实字段：${unmatchedReferences.join("、")}。`, { retryable: true });
  }
  const customerMarkdown = parsed.data.replace(/\n?<!--(?:[\s\S]*?)-->\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { markdown: customerMarkdown, assertionIds, openItems, unmatchedReferences };
}
