import { describe, expect, it } from "vitest";
import { appCategories, appCategoryRegistry, getAppCategory } from "@/src/categories";

describe("app category registry", () => {
  it("contains exactly 39 unique statutory categories", () => {
    expect(appCategories).toHaveLength(39);
    expect(new Set(appCategories.map((item) => item.key)).size).toBe(39);
    expect(appCategoryRegistry.source).toContain("必要个人信息范围规定");
    expect(appCategoryRegistry.categoryVersion).toBe("app-categories-v1.1.0");
  });

  it("opens the eight travel and daily-life questionnaires", () => {
    expect(appCategories.filter((item) => item.availability === "OPEN").map((item) => item.key)).toEqual([
      "map-navigation", "ride-hailing", "transport-ticket", "travel-service",
      "hotel-service", "local-life", "vehicle-service", "performance-ticket",
    ]);
    expect(getAppCategory("map-navigation")).toMatchObject({ label: "地图导航", formVersion: "map-questionnaire-v2.0.0" });
    expect(getAppCategory("ride-hailing")).toMatchObject({ label: "网络约车", formVersion: "mobility-questionnaire-v1.0.0" });
  });
});
