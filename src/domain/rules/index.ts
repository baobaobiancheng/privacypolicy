import { DomainError } from "../errors";

export type FactVerificationStatus = "UNCONFIRMED" | "CLIENT_CONFIRMED" | "LAWYER_CONFIRMED" | "EXCLUDED" | "CONFLICT";
export type LegalReviewStatus = "NOT_REQUIRED" | "PENDING" | "LAWYER_REVIEWED" | "NEEDS_CHANGE";
export type OriginType = "REGULATION" | "EXPERT_CONTENT" | "REFERENCE_POLICY" | "AI_INFERRED" | "CLIENT_ORIGINAL";

export type FactAssertion = {
  assertionId: string;
  activityKey?: string;
  fieldKey: string;
  value: string | number | boolean | null;
  originType: OriginType;
  factVerification: FactVerificationStatus;
  legalReview: LegalReviewStatus;
  current: boolean;
};

export type ActivityFacts = {
  activityKey: string;
  featureKey: string;
  selected: boolean;
  requiredFields: string[];
  assertions: FactAssertion[];
  riskCode?: string | null;
  lawfulBasis?: string | null;
  retentionPeriod?: string | null;
  purpose?: string | null;
};

export type ScopeInput = Record<string, boolean>;

export type RuleFinding = {
  code: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  message: string;
  activityKey?: string;
  fieldKey?: string;
};

export type RuleEvaluation = {
  findings: RuleFinding[];
  blocking: RuleFinding[];
  warnings: RuleFinding[];
  riskCodes: string[];
  exportable: boolean;
};

const confirmedFactStatuses = new Set<FactVerificationStatus>(["CLIENT_CONFIRMED", "LAWYER_CONFIRMED"]);

export function evaluateScope(scope: ScopeInput): RuleEvaluation {
  const requiredGates = ["single-product", "map-primary", "single-category", "no-cross-border"];
  const findings = requiredGates.flatMap<RuleFinding>((gate) => scope[gate] ? [] : [{
    code: "SCOPE_NOT_SUPPORTED",
    severity: "BLOCKING",
    message: "当前项目不满足地图类首期范围门禁。",
    fieldKey: gate,
  }]);
  return summarize(findings);
}

export function evaluateActivities(activities: ActivityFacts[]): RuleEvaluation {
  const findings: RuleFinding[] = [];
  const riskCodes = new Set<string>();

  for (const activity of activities) {
    if (!activity.selected) continue;
    if (activity.riskCode) riskCodes.add(activity.riskCode);
    const currentByField = new Map(activity.assertions.filter((assertion) => assertion.current).map((assertion) => [assertion.fieldKey, assertion]));

    for (const fieldKey of activity.requiredFields) {
      const assertion = currentByField.get(fieldKey);
      if (!assertion || assertion.factVerification === "CONFLICT") {
        findings.push({ code: "FIELD_INVALID", severity: "BLOCKING", message: "必填事实缺失或存在冲突。", activityKey: activity.activityKey, fieldKey });
        continue;
      }
      if (!confirmedFactStatuses.has(assertion.factVerification)) {
        findings.push({ code: "FACT_UNCONFIRMED", severity: "WARNING", message: "该事实尚未由客户或律师确认，将以显式占位符进入工作草稿。", activityKey: activity.activityKey, fieldKey });
      }
      if (assertion.originType === "REFERENCE_POLICY" || assertion.originType === "AI_INFERRED") {
        if (!confirmedFactStatuses.has(assertion.factVerification)) {
          findings.push({ code: "REFERENCE_FACT_NOT_CONFIRMED", severity: "WARNING", message: "参考政策或 AI 候选不能直接进入正文。", activityKey: activity.activityKey, fieldKey });
        }
      }
    }

    if (!activity.purpose?.trim()) {
      findings.push({ code: "PURPOSE_MISSING", severity: "WARNING", message: "处理目的仍待客户补充。", activityKey: activity.activityKey });
    }
    if (!activity.retentionPeriod?.trim()) {
      findings.push({ code: "RETENTION_MISSING", severity: "WARNING", message: "保存期限仍待客户补充。", activityKey: activity.activityKey });
    }
    if (!activity.lawfulBasis?.trim()) {
      findings.push({ code: "LAWFUL_BASIS_PENDING", severity: "WARNING", message: "处理法律依据需要律师判断。", activityKey: activity.activityKey });
    }
  }

  return summarize(findings, [...riskCodes]);
}

export function evaluateExportInvariants(input: {
  scope: ScopeInput;
  activities: ActivityFacts[];
  commonFacts: FactAssertion[];
}): RuleEvaluation {
  const scopeResult = evaluateScope(input.scope);
  const activityResult = evaluateActivities(input.activities);
  const findings = [...scopeResult.findings, ...activityResult.findings];
  const currentCommonFacts = input.commonFacts.filter((fact) => fact.current);

  for (const fact of currentCommonFacts) {
    if (fact.factVerification === "CONFLICT") {
      findings.push({ code: "FIELD_INVALID", severity: "BLOCKING", message: "通用披露信息存在冲突。", fieldKey: fact.fieldKey });
    }
    if (fact.originType === "REFERENCE_POLICY" || fact.originType === "AI_INFERRED") {
      if (!confirmedFactStatuses.has(fact.factVerification)) {
        findings.push({ code: "REFERENCE_FACT_NOT_CONFIRMED", severity: "WARNING", message: "通用披露候选未经客户确认，不得作为无标记事实进入正文。", fieldKey: fact.fieldKey });
      }
    }
  }

  return summarize(findings, [...activityResult.riskCodes]);
}

export function assertCanExport(evaluation: RuleEvaluation): void {
  if (!evaluation.exportable) {
    throw new DomainError("EXPORT_BLOCKED", "当前项目存在阻断项，请先完成必要信息或范围处理。", {
      details: Object.fromEntries(evaluation.blocking.map((finding, index) => [`finding_${index + 1}`, finding.code])),
    });
  }
}

function summarize(findings: RuleFinding[], riskCodes: string[] = []): RuleEvaluation {
  const blocking = findings.filter((finding) => finding.severity === "BLOCKING");
  const warnings = findings.filter((finding) => finding.severity === "WARNING");
  return {
    findings,
    blocking,
    warnings,
    riskCodes: [...new Set(riskCodes)],
    exportable: blocking.length === 0,
  };
}
