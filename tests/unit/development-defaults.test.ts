import { describe, expect, it } from "vitest";
import { createDevelopmentProjectDefaults } from "@/src/workspace/development-defaults";
import { evaluateFormalPolicyReadiness } from "@/src/knowledge/readiness";

describe("development form defaults", () => {
  it("provides a complete map project that can reach draft generation", () => {
    const defaults = createDevelopmentProjectDefaults();
    const result = evaluateFormalPolicyReadiness(defaults);

    expect(defaults.selected).toHaveLength(5);
    expect(Object.values(defaults.fieldAnswers ?? {}).filter((value) => value === "PROCESS")).toHaveLength(18);
    expect(defaults.permissions.find((item) => item.key === "location")?.scenes).toEqual([
      "展示当前位置",
      "地点搜索与路线规划",
      "实时导航",
      "提供实时路况",
    ]);
    expect(defaults.profile.rightsEntry).toBe("App 内「我的—设置—隐私中心」");
    expect(defaults.activityDetails.navigation.purpose).toContain("实时导航与路线偏离提醒");
    expect(defaults.processingActivities.find((item) => item.featureKey === "navigation")?.informationOther).toContain("蓝牙信标信息");
    expect(defaults.profile.platform).toBe("Android、HarmonyOS");
    expect(defaults.supplementAnswers["background-location"].slots?.trigger.value).toBe("用户主动开始导航后");
    expect(result.ready).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
});
