import { describe, expect, it } from "vitest";
import { appCategories, appCategoryRegistry, getAppCategory } from "@/src/categories";

describe("app category registry", () => {
  it("contains exactly 39 unique statutory categories", () => {
    expect(appCategories).toHaveLength(39);
    expect(new Set(appCategories.map((item) => item.key)).size).toBe(39);
    expect(appCategoryRegistry.source).toContain("必要个人信息范围规定");
    expect(appCategoryRegistry.categoryVersion).toBe("app-categories-v1.2.0");
  });

  it("opens all 39 statutory categories with a questionnaire version", () => {
    expect(appCategories.filter((item) => item.availability === "OPEN")).toHaveLength(39);
    expect(appCategories.every((item) => Boolean(item.formVersion))).toBe(true);
    expect(getAppCategory("map-navigation")).toMatchObject({ label: "地图导航", formVersion: "map-questionnaire-v2.0.0" });
    expect(getAppCategory("ride-hailing")).toMatchObject({ label: "网络约车", formVersion: "mobility-questionnaire-v1.0.0" });
    expect(getAppCategory("online-payment")).toMatchObject({ label: "网络支付", formVersion: "universal-questionnaire-v1.0.0" });
    expect(getAppCategory("practical-tools")).toMatchObject({ label: "实用工具", formVersion: "universal-questionnaire-v1.0.0" });
  });
});
