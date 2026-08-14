import { describe, expect, it } from "vitest";
import { resolveAcknowledgedReviewToken } from "@/src/application/draft-regeneration";

// Regression: ISSUE-001 — regeneration sent acknowledgedPreflightReviewToken:null
// Found by /qa on 2026-08-14
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-08-14.md
describe("regeneration review-token request payload", () => {
  it("omits the token when a hydrated successful project has no active preflight review", () => {
    expect(resolveAcknowledgedReviewToken(null, [], [])).toBeUndefined();
  });

  it("sends the token only after every active blocking issue is acknowledged", () => {
    expect(resolveAcknowledgedReviewToken("sha256:review", ["a", "b"], ["a"])).toBeUndefined();
    expect(resolveAcknowledgedReviewToken("sha256:review", ["a", "b"], ["a", "b"])).toBe("sha256:review");
  });
});
