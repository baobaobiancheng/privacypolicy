import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  filterAcknowledgedBlockingIssues,
  resolvePreflightExecutionPlan,
  validatePreflightAcknowledgements,
} from "@/src/application/generation/preflight-acknowledgements";
import { preflightIssueFingerprint } from "@/src/domain/preflight-issue";
import type { PreflightIssue } from "@/src/ai/policy-preflight";

const issue: PreflightIssue = {
  id: "retention-conflict",
  severity: "BLOCKING",
  category: "CONTRADICTION",
  title: "保存期限存在冲突",
  description: "两处保存期限无法同时成立。",
  targetStep: "supplement",
  relatedPaths: ["storageAndSecurity.fixedPeriod", "supplementAnswers.support.detail"],
  questionForUser: "请确认实际保存期限。",
};

describe("preflight acknowledgements", () => {
  it("removes only an explicitly acknowledged blocking issue", () => {
    const fingerprint = preflightIssueFingerprint(issue);
    expect(filterAcknowledgedBlockingIssues([issue, issue], [])).toEqual([issue]);
    expect(filterAcknowledgedBlockingIssues([issue], [fingerprint])).toEqual([]);
  });

  it("accepts fingerprints emitted by a failed generation with the same input hash", async () => {
    const fingerprint = preflightIssueFingerprint(issue);
    const prisma = {
      generationJob: {
        findMany: async () => [{ errorDetails: { issues: [issue] } }],
      },
    } as unknown as PrismaClient;
    await expect(validatePreflightAcknowledgements(prisma, "prj_test", "sha256:test", [fingerprint, fingerprint]))
      .resolves.toEqual([fingerprint]);
  });

  it("rejects a fingerprint that was not emitted for the current input", async () => {
    const prisma = {
      generationJob: {
        findMany: async () => [],
      },
    } as unknown as PrismaClient;
    await expect(validatePreflightAcknowledgements(prisma, "prj_test", "sha256:test", [preflightIssueFingerprint(issue)]))
      .rejects.toMatchObject({ code: "FIELD_INVALID" });
  });

  it("advances fact checking to the next server-controlled round", async () => {
    const prisma = {
      generationJob: {
        findMany: async () => [{ errorDetails: { issues: [issue], lawKeywords: ["个人信息保护法"], preflightRound: 1 } }],
      },
    } as unknown as PrismaClient;

    await expect(resolvePreflightExecutionPlan(prisma, "prj_test", "sha256:test", [preflightIssueFingerprint(issue)]))
      .resolves.toMatchObject({ round: 2 });
  });

  it("reuses the confirmed third-round result instead of starting a fourth check", async () => {
    const fingerprint = preflightIssueFingerprint(issue);
    const prisma = {
      generationJob: {
        findMany: async () => [{ errorDetails: { issues: [issue], lawKeywords: ["个人信息保护法"], preflightRound: 3 } }],
      },
    } as unknown as PrismaClient;

    await expect(resolvePreflightExecutionPlan(prisma, "prj_test", "sha256:test", [fingerprint]))
      .resolves.toEqual({
        acknowledgedFingerprints: [fingerprint],
        round: 3,
        cachedPreflight: { issues: [issue], lawKeywords: ["个人信息保护法"] },
      });
  });

  it("does not bypass unresolved issues after the third round", async () => {
    const prisma = {
      generationJob: {
        findMany: async () => [{ errorDetails: { issues: [issue], lawKeywords: ["个人信息保护法"], preflightRound: 3 } }],
      },
    } as unknown as PrismaClient;

    await expect(resolvePreflightExecutionPlan(prisma, "prj_test", "sha256:test", []))
      .rejects.toMatchObject({ code: "FIELD_INVALID" });
  });
});
