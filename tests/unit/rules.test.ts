import { describe, expect, it } from "vitest";
import { evaluateActivities, evaluateExportInvariants, evaluateScope, type ActivityFacts } from "@/src/domain/rules";

const scope = { "single-product": true, "map-primary": true, "single-category": true, "no-cross-border": true };

function activity(overrides: Partial<ActivityFacts> = {}): ActivityFacts {
  return {
    activityKey: "activity-navigation",
    featureKey: "navigation",
    selected: true,
    requiredFields: ["location", "origin", "destination"],
    assertions: [
      { assertionId: "a-location", activityKey: "activity-navigation", fieldKey: "location", value: "实时位置", originType: "CLIENT_ORIGINAL", factVerification: "CLIENT_CONFIRMED", legalReview: "NOT_REQUIRED", current: true },
      { assertionId: "a-origin", activityKey: "activity-navigation", fieldKey: "origin", value: "杭州", originType: "CLIENT_ORIGINAL", factVerification: "CLIENT_CONFIRMED", legalReview: "NOT_REQUIRED", current: true },
      { assertionId: "a-destination", activityKey: "activity-navigation", fieldKey: "destination", value: "上海", originType: "CLIENT_ORIGINAL", factVerification: "CLIENT_CONFIRMED", legalReview: "NOT_REQUIRED", current: true },
    ],
    purpose: "提供定位和路线规划",
    retentionPeriod: "导航结束后删除或去标识化",
    lawfulBasis: "待律师判断",
    ...overrides,
  };
}

describe("确定性规则内核", () => {
  it("范围门禁缺一项就阻断", () => {
    const result = evaluateScope({ ...scope, "no-cross-border": false });
    expect(result.exportable).toBe(false);
    expect(result.blocking.map((finding) => finding.code)).toContain("SCOPE_NOT_SUPPORTED");
  });

  it("字段缺失阻断，未确认字段只产生警告", () => {
    const missing = activity({ assertions: [] });
    expect(evaluateActivities([missing]).blocking).toHaveLength(3);

    const candidate = activity({
      assertions: activity().assertions.map((assertion) => ({ ...assertion, factVerification: "UNCONFIRMED" as const })),
    });
    const result = evaluateActivities([candidate]);
    expect(result.exportable).toBe(true);
    expect(result.warnings.map((finding) => finding.code)).toContain("FACT_UNCONFIRMED");
  });

  it("参考政策候选不能无标记进入客户事实正文", () => {
    const result = evaluateExportInvariants({
      scope,
      activities: [activity({ assertions: activity().assertions.map((assertion) => ({ ...assertion, originType: "REFERENCE_POLICY" as const, factVerification: "UNCONFIRMED" as const })) })],
      commonFacts: [],
    });
    expect(result.exportable).toBe(true);
    expect(result.warnings.map((finding) => finding.code)).toContain("REFERENCE_FACT_NOT_CONFIRMED");
  });
});
