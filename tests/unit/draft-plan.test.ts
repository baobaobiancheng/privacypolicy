import { describe, expect, it } from "vitest";
import { buildDraftPlan } from "@/src/domain/draft/export-plan";

describe("工作草稿编排", () => {
  it("已确认事实进入正文，未确认事实进入显式复核附录", () => {
    const plan = buildDraftPlan({
      evaluation: { findings: [], blocking: [], warnings: [], riskCodes: [], exportable: true },
      assertions: [
        { assertionId: "confirmed", activityKey: "navigation", fieldKey: "origin", value: "杭州", originType: "CLIENT_ORIGINAL", factVerification: "CLIENT_CONFIRMED", legalReview: "NOT_REQUIRED", current: true, evidenceIds: ["REG-map-01"] },
        { assertionId: "pending", activityKey: "support", fieldKey: "retention", value: null, originType: "CLIENT_ORIGINAL", factVerification: "UNCONFIRMED", legalReview: "PENDING", current: true },
      ],
    });
    expect(plan.body.map((node) => node.assertionId)).toEqual(["confirmed"]);
    expect(plan.reviewAppendix[0].text).toBe("[[待确认:retention]]");
    expect(plan.watermark).toBe("工作草稿 · 律师复核前");
  });

  it("EXCLUDED 断言既不进正文也不进复核附录", () => {
    const plan = buildDraftPlan({
      evaluation: { findings: [], blocking: [], warnings: [], riskCodes: [], exportable: true },
      assertions: [
        { assertionId: "excluded", activityKey: "support", fieldKey: "case_material", value: "问题材料", originType: "CLIENT_ORIGINAL", factVerification: "EXCLUDED", legalReview: "NOT_REQUIRED", current: true },
      ],
    });
    expect(plan.body).toHaveLength(0);
    expect(plan.reviewAppendix).toHaveLength(0);
  });
});
