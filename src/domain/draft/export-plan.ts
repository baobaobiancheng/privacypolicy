import type { FactAssertion, RuleEvaluation } from "@/src/domain/rules";

export type DraftNode = {
  clauseId: string;
  text: string;
  assertionId: string;
  evidenceIds: string[];
  placeholder: boolean;
};

export type DraftPlan = {
  body: DraftNode[];
  reviewAppendix: DraftNode[];
  blockingCodes: string[];
  riskCodes: string[];
  watermark: "工作草稿 · 律师复核前";
};

export function buildDraftPlan(input: {
  evaluation: RuleEvaluation;
  assertions: Array<FactAssertion & { clauseId?: string; evidenceIds?: string[]; activityKey?: string }>;
}): DraftPlan {
  const body: DraftNode[] = [];
  const reviewAppendix: DraftNode[] = [];

  for (const assertion of input.assertions.filter((item) => item.current)) {
    // EXCLUDED：客户明确不处理的可选字段，既不进正文，也不生成待确认占位符。
    if (assertion.factVerification === "EXCLUDED") continue;
    const confirmedFact = assertion.factVerification === "CLIENT_CONFIRMED" || assertion.factVerification === "LAWYER_CONFIRMED";
    const legalReady = assertion.legalReview === "LAWYER_REVIEWED" || assertion.legalReview === "NOT_REQUIRED";
    const allowedOrigin = assertion.originType !== "REFERENCE_POLICY" && assertion.originType !== "AI_INFERRED";
    const placeholder = !confirmedFact || !legalReady || !allowedOrigin || assertion.factVerification === "CONFLICT";
    const node: DraftNode = {
      clauseId: assertion.clauseId ?? `fact-${assertion.assertionId}`,
      text: placeholder ? `[[待确认:${assertion.fieldKey}]]` : String(assertion.value ?? ""),
      assertionId: assertion.assertionId,
      evidenceIds: assertion.evidenceIds ?? [],
      placeholder,
    };
    if (placeholder) reviewAppendix.push(node);
    else body.push(node);
  }

  return {
    body,
    reviewAppendix,
    blockingCodes: input.evaluation.blocking.map((finding) => finding.code),
    riskCodes: input.evaluation.riskCodes,
    watermark: "工作草稿 · 律师复核前",
  };
}
