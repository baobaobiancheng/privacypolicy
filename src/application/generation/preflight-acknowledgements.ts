import type { PrismaClient } from "@prisma/client";
import {
  GenerationPreflightSchema,
  PreflightIssueSchema,
  type GenerationPreflight,
  type PreflightIssue,
} from "@/src/ai/policy-preflight";
import { DomainError } from "@/src/domain/errors";
import { preflightIssueFingerprint } from "@/src/domain/preflight-issue";

const MAX_ACKNOWLEDGED_ISSUES = 20;
export const MAX_PREFLIGHT_ROUNDS = 3;

export type PreflightExecutionPlan = {
  acknowledgedFingerprints: string[];
  round: number;
  cachedPreflight?: GenerationPreflight;
};

export function filterAcknowledgedBlockingIssues(
  issues: PreflightIssue[],
  acknowledgedFingerprints: readonly string[],
): PreflightIssue[] {
  const acknowledged = new Set(acknowledgedFingerprints);
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (issue.severity !== "BLOCKING") return false;
    const fingerprint = preflightIssueFingerprint(issue);
    if (seen.has(fingerprint) || acknowledged.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

export async function validatePreflightAcknowledgements(
  prisma: PrismaClient,
  projectId: string,
  inputHash: string,
  requestedFingerprints: readonly string[],
): Promise<string[]> {
  return (await resolvePreflightExecutionPlan(
    prisma,
    projectId,
    inputHash,
    requestedFingerprints,
  )).acknowledgedFingerprints;
}

export async function resolvePreflightExecutionPlan(
  prisma: PrismaClient,
  projectId: string,
  inputHash: string,
  requestedFingerprints: readonly string[],
): Promise<PreflightExecutionPlan> {
  const requested = [...new Set(requestedFingerprints.map((item) => item.trim()).filter(Boolean))];
  if (requested.length > MAX_ACKNOWLEDGED_ISSUES) {
    throw new DomainError("FIELD_INVALID", "确认的事实核对项数量超过限制。", { retryable: false });
  }

  const failures = await prisma.generationJob.findMany({
    where: {
      projectId,
      inputHash,
      state: "FAILED",
      errorCode: "FORM_SEMANTIC_REVIEW_REQUIRED",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { errorDetails: true },
  });
  const allowed = new Set<string>();
  const parsedFailures = failures.map((failure) => {
    const details = asRecord(failure.errorDetails);
    const issues = Array.isArray(details.issues) ? details.issues : [];
    const parsedIssues: PreflightIssue[] = [];
    for (const candidate of issues) {
      const parsed = PreflightIssueSchema.safeParse(candidate);
      if (parsed.success) {
        parsedIssues.push(parsed.data);
        allowed.add(preflightIssueFingerprint(parsed.data));
      }
    }
    const explicitRound = typeof details.preflightRound === "number"
      && Number.isInteger(details.preflightRound)
      && details.preflightRound >= 1
      && details.preflightRound <= MAX_PREFLIGHT_ROUNDS
      ? details.preflightRound
      : 1;
    return { details, issues: parsedIssues, round: explicitRound };
  });

  const invalid = requested.filter((fingerprint) => !allowed.has(fingerprint));
  if (invalid.length > 0) {
    throw new DomainError("FIELD_INVALID", "事实核对项已失效，请重新生成并核对当前版本。", {
      retryable: false,
      details: { invalidCount: invalid.length },
    });
  }

  const latest = parsedFailures[0];
  if (!latest) return { acknowledgedFingerprints: requested, round: 1 };
  if (latest.round < MAX_PREFLIGHT_ROUNDS) {
    return { acknowledgedFingerprints: requested, round: latest.round + 1 };
  }

  const acknowledged = new Set(requested);
  const latestBlockingFingerprints = latest.issues
    .filter((issue) => issue.severity === "BLOCKING")
    .map(preflightIssueFingerprint);
  if (!latestBlockingFingerprints.every((fingerprint) => acknowledged.has(fingerprint))) {
    throw new DomainError("FIELD_INVALID", "已完成三轮事实核对，请先确认本轮全部待核对项。", {
      retryable: false,
    });
  }

  const cachedPreflight = GenerationPreflightSchema.safeParse({
    issues: latest.issues,
    lawKeywords: latest.details.lawKeywords,
  });
  if (!cachedPreflight.success) {
    throw new DomainError("MODEL_OUTPUT_INVALID", "第三轮事实核对结果不完整，请修改表单后重新生成。", {
      retryable: false,
    });
  }
  return {
    acknowledgedFingerprints: requested,
    round: MAX_PREFLIGHT_ROUNDS,
    cachedPreflight: cachedPreflight.data,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
