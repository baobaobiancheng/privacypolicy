import { describe, expect, it } from "vitest";
import { canReuseSuccessfulFactReview, createGenerationId, fallbackMapLawKeywords, haveEquivalentDraftInput } from "@/src/application/draft-regeneration";

describe("draft regeneration", () => {
  it("creates a fresh id while the project revision remains unchanged", () => {
    expect(createGenerationId("map-project", 1_000)).not.toBe(createGenerationId("map-project", 1_001));
  });

  it("reuses fact review only for the exact input that already succeeded", () => {
    expect(canReuseSuccessfulFactReview("sha256:same", ["sha256:same"])).toBe(true);
    expect(canReuseSuccessfulFactReview("sha256:changed", ["sha256:same"])).toBe(false);
  });

  it("treats reordered JSON object keys as the same immutable form", () => {
    expect(haveEquivalentDraftInput(
      { profile: { productName: "行迹地图", version: "2.4" }, selected: ["navigation"] },
      [{ selected: ["navigation"], profile: { version: "2.4", productName: "行迹地图" } }],
    )).toBe(true);
  });

  it("has a bounded deterministic law-query fallback for an approved map form", () => {
    const keywords = fallbackMapLawKeywords({ hasLocation: true, hasThirdParty: true });
    expect(keywords).toContain("个人信息保护法");
    expect(keywords).toContain("敏感个人信息 位置信息");
    expect(keywords.length).toBeLessThanOrEqual(5);
  });
});
