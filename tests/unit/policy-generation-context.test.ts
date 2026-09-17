import { describe, expect, it } from "vitest";
import { buildPolicyGenerationContext } from "@/src/application/generation/policy-generation-context";
import { createDevelopmentProjectFormData } from "@/src/workspace/development-defaults";
import { toGenerationForm } from "@/src/workspace/form-adapter";
import { getAppQuestionnaire } from "@/src/questionnaires";

const mapQuestionnaire = getAppQuestionnaire("map-navigation");

describe("PolicyGenerationContext", () => {
  it("keeps canonical facts without transmitting legacy duplicates", () => {
    const form = createDevelopmentProjectFormData();
    const legacy = toGenerationForm(form);
    const context = buildPolicyGenerationContext(form, mapQuestionnaire);

    expect(legacy).not.toHaveProperty("projectFacts");
    expect(context.activities).toEqual(form.processingActivities);
    expect(context.permissions).toEqual(form.permissions);
    expect(context.partners).toEqual(form.partners);
    expect(context.storageAndSecurity).toEqual(form.storageAndSecurity);
    expect(context.rightsAndGovernance).toEqual(form.rightsAndGovernance);
    expect(context.category).toEqual({
      key: "map-navigation",
      label: "地图导航",
      basicFunction: "定位、地图浏览、路线规划与导航",
      necessaryInfoBaseline: "位置信息、出发地、到达地",
    });
  });

  it("carries the selected category baseline into generation context", () => {
    const questionnaire = getAppQuestionnaire("ride-hailing");
    const form = createDevelopmentProjectFormData("ride-hailing");
    const context = buildPolicyGenerationContext(form, questionnaire);

    expect(context.category.key).toBe("ride-hailing");
    expect(context.category.label).toBe("网络约车");
    expect(context.category.basicFunction).toContain("出租汽车");
    expect(context.category.necessaryInfoBaseline).toContain("乘车人出发地");
    expect(context.activities.map((activity) => activity.featureKey)).toContain("ride-booking");
    expect(context.activities.map((activity) => activity.featureKey)).not.toContain("navigation");
  });

  it("carries a non-mobility statutory baseline and facts into generation context", () => {
    const questionnaire = getAppQuestionnaire("online-payment");
    const form = createDevelopmentProjectFormData("online-payment");
    const context = buildPolicyGenerationContext(form, questionnaire);

    expect(context.category.key).toBe("online-payment");
    expect(context.category.label).toBe("网络支付");
    expect(context.category.necessaryInfoBaseline).toContain("银行卡");
    expect(context.activities.map((activity) => activity.featureKey)).toContain("payment-transaction");
    expect(context.activities.map((activity) => activity.featureKey)).not.toContain("navigation");
    expect(context.profile.productName).toBe("安付");
  });

  it("only includes confirmed attachment contents and supplement slots", () => {
    const form = createDevelopmentProjectFormData();
    form.attachments = [
      { id: "pending", name: "pending.txt", kind: "TEXT", status: "PENDING", mimeType: "text/plain", size: 1, content: "pending", truncated: false },
      { id: "confirmed", name: "confirmed.txt", kind: "TEXT", status: "CONFIRMED", mimeType: "text/plain", size: 1, content: "confirmed", truncated: false },
    ];
    form.supplementAnswers["third-party-services"] = {
      answer: "YES",
      detail: "raw text",
      slots: {
        name: { value: "confirmed SDK", status: "CONFIRMED" },
        candidate: { value: "candidate SDK", status: "CANDIDATE" },
      },
    };
    form.supplementAnswers["unconfirmed-topic"] = {
      answer: "UNKNOWN",
      detail: "尚未确认，不应发送给模型",
      slots: {},
    };

    const context = buildPolicyGenerationContext(form, mapQuestionnaire);
    expect(context.confirmedAttachments).toEqual([{ name: "confirmed.txt", kind: "TEXT", content: "confirmed", truncated: false }]);
    expect(context.confirmedSupplements["third-party-services"]?.detail).toBe("");
    expect(Object.keys(context.confirmedSupplements["third-party-services"]?.slots ?? {})).toEqual(["name"]);
    expect(context.confirmedSupplements).not.toHaveProperty("unconfirmed-topic");
  });

  it("reduces the model fact payload by at least thirty percent", () => {
    const form = createDevelopmentProjectFormData();
    const oldPayload = JSON.stringify({ ...toGenerationForm(form), projectFacts: form });
    const compactPayload = JSON.stringify(buildPolicyGenerationContext(form, mapQuestionnaire));
    expect(compactPayload.length).toBeLessThanOrEqual(oldPayload.length * 0.7);
  });
});
