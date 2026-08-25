import { describe, expect, it } from "vitest";
import { calculateProjectProgress, FORM_SCHEMA_VERSION, ProjectFormDataSchema } from "@/src/workspace/contract";
import { toGenerationForm } from "@/src/workspace/form-adapter";

describe("workspace progress", () => {
  it("does not count empty section objects as completed", () => {
    expect(calculateProjectProgress({
      profile: {},
      processingActivities: [],
      supplementAnswers: {},
      storageAndSecurity: {},
      rightsAndGovernance: {},
    })).toBe(0);
  });

  it("counts a manually added information item as a valid processing activity", () => {
    expect(calculateProjectProgress({
      processingActivities: [{
        featureKey: "navigation",
        title: "定位和导航",
        kind: "BASIC",
        informationItems: [],
        informationOther: ["搜索关键词"],
        purposes: ["路线规划"],
        purposeOther: "",
      }],
    })).toBe(17);
  });

  it("passes every canonical Core v2 fact section to the model context", () => {
    const form = ProjectFormDataSchema.parse({
      schemaVersion: FORM_SCHEMA_VERSION,
      profile: {
        operatorName: "测试公司", operatorContact: "测试地址", productName: "测试地图", productVersion: "1.0",
        contactEmail: "privacy@example.com", rightsEntry: "设置-隐私中心", rightsResponsePeriod: "15个工作日",
        minorProcessing: "不面向未成年人", securityMeasures: "HTTPS 传输", incidentChannel: "App 弹窗",
        policyEffectiveDate: "2026-08-25", policyUpdateNotice: "App 弹窗",
      },
      processingActivities: [{
        featureKey: "navigation", title: "定位和导航", kind: "BASIC",
        informationItems: ["位置信息"], informationOther: ["蓝牙信标信息"], purposes: ["路线规划"], purposeOther: "",
      }],
      partners: [
        { name: "定位 SDK", provider: "甲公司", purposes: ["定位"], informationItems: ["位置信息"] },
        { name: "推送 SDK", provider: "乙公司", purposes: ["消息推送"], informationItems: ["设备标识信息"] },
      ],
    });

    const generation = toGenerationForm(form);
    const projectFacts = generation.projectFacts as typeof form;
    expect(projectFacts.processingActivities[0]?.informationOther).toEqual(["蓝牙信标信息"]);
    expect(projectFacts.partners.map((partner) => partner.name)).toEqual(["定位 SDK", "推送 SDK"]);
  });
});
