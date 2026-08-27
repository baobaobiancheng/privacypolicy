import { describe, expect, it } from "vitest";
import { getAppCategory } from "@/src/categories";
import {
  APP_CATEGORY_KEYS,
  getAppQuestionnaire,
  getQuestionnaireFeature,
} from "@/src/questionnaires";
import { createDevelopmentProjectFormData } from "@/src/workspace/development-defaults";
import { toGenerationForm, toWorkspaceCompatibilityState } from "@/src/workspace/form-adapter";

describe("app questionnaires", () => {
  it("provides an independent, versioned questionnaire for every statutory category", () => {
    expect(APP_CATEGORY_KEYS).toHaveLength(39);
    for (const categoryKey of APP_CATEGORY_KEYS) {
      const category = getAppCategory(categoryKey);
      const questionnaire = getAppQuestionnaire(categoryKey);
      expect(category?.availability).toBe("OPEN");
      expect(questionnaire.categoryLabel).toBe(category?.label);
      expect(questionnaire.formVersion).toBe(category?.formVersion);
      expect(questionnaire.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(questionnaire.features.some((feature) => feature.kind === "BASIC")).toBe(true);
      expect(new Set(questionnaire.features.map((feature) => feature.key)).size).toBe(questionnaire.features.length);
      for (const feature of questionnaire.features) {
        expect(feature.fields.length).toBeGreaterThan(0);
        expect(feature.purposes.length).toBeGreaterThan(0);
        expect(new Set(feature.fields.map((field) => field.key)).size).toBe(feature.fields.length);
      }
    }
  });

  it("keeps statutory necessary-information baselines explicit", () => {
    const requiredLabels = (categoryKey: string) => getAppQuestionnaire(categoryKey).features
      .flatMap((feature) => feature.fields)
      .filter((field) => field.required)
      .map((field) => field.label);

    expect(requiredLabels("ride-hailing")).toEqual(expect.arrayContaining([
      "注册用户移动电话号码", "乘车人出发地", "乘车人到达地", "乘车人位置信息", "乘车人行踪轨迹", "支付时间", "支付金额", "支付渠道",
    ]));
    expect(requiredLabels("transport-ticket")).toEqual(expect.arrayContaining([
      "旅客姓名", "证件类型和号码", "旅客类型", "旅客出发地", "旅客目的地", "出发时间", "支付时间",
    ]));
    expect(requiredLabels("travel-service")).toEqual(expect.arrayContaining(["旅游目的地", "旅游时间", "出行人姓名", "证件类型和号码", "出行人联系方式"]));
    expect(requiredLabels("hotel-service")).toEqual(expect.arrayContaining(["住宿人姓名", "住宿人联系方式", "入住时间", "退房时间", "入住酒店名称"]));
    expect(requiredLabels("local-life")).toEqual(["注册用户移动电话号码"]);
    expect(requiredLabels("vehicle-service")).toEqual(expect.arrayContaining(["驾驶证件信息", "位置信息", "支付时间", "支付金额", "支付渠道"]));
    expect(requiredLabels("performance-ticket")).toEqual(expect.arrayContaining(["注册用户移动电话号码", "观演场次", "座位号（如有）", "支付时间", "支付金额", "支付渠道"]));
    expect(requiredLabels("instant-messaging")).toEqual(expect.arrayContaining(["注册用户移动电话号码", "即时通信账号", "即时通信联系人账号列表"]));
    expect(requiredLabels("dating")).toEqual(expect.arrayContaining(["注册用户移动电话号码", "性别", "年龄", "婚姻状况"]));
    expect(requiredLabels("online-payment")).toEqual(expect.arrayContaining(["注册用户移动电话号码", "注册用户姓名", "证件类型和号码", "证件有效期限", "银行卡号码"]));
    expect(requiredLabels("mail-express")).toEqual(expect.arrayContaining(["寄件人姓名", "寄件人证件类型和号码等身份信息", "收件人姓名（名称）", "寄递物品名称", "寄递物品性质", "寄递物品数量"]));
    expect(requiredLabels("mobile-banking")).toEqual(expect.arrayContaining(["注册用户移动电话号码", "用户姓名", "证件影印件", "银行预留移动电话号码", "收款人姓名", "收款人开户银行信息"]));
    expect(requiredLabels("medical-registration")).toEqual(expect.arrayContaining(["注册用户移动电话号码", "患者姓名", "患者证件类型和号码", "预约挂号的医院", "预约挂号的科室", "病情描述"]));

    const noStatutoryInformationCategories = [
      "live-streaming", "online-av", "short-video", "news", "womens-health", "fitness", "ebook",
      "browser", "input-method", "security-management", "camera-beauty", "app-store", "practical-tools",
    ];
    for (const categoryKey of noStatutoryInformationCategories) {
      expect(requiredLabels(categoryKey)).toEqual([]);
      expect(getAppCategory(categoryKey)?.necessaryInfoSummary).toBe("无需个人信息即可使用基本功能");
    }
  });

  it("builds category-specific development facts instead of map facts for all 39 categories", () => {
    for (const categoryKey of APP_CATEGORY_KEYS) {
      const form = createDevelopmentProjectFormData(categoryKey);
      const generation = toGenerationForm(form, categoryKey);
      const questionnaire = getAppQuestionnaire(categoryKey);
      if (categoryKey !== "map-navigation") {
        expect(form.processingActivities.map((activity) => activity.featureKey)).toEqual(
          questionnaire.features.filter((feature) => feature.defaultSelection).map((feature) => feature.key),
        );
      }
      expect(generation.selected).toEqual(form.processingActivities.map((activity) => activity.featureKey));
      expect(generation.selected.every((featureKey) => getQuestionnaireFeature(categoryKey, featureKey))).toBe(true);
    }

    const form = createDevelopmentProjectFormData("hotel-service");
    const generation = toGenerationForm(form, "hotel-service");
    expect(form.profile.productName).toBe("示例酒店服务产品");
    expect(generation.selected).toContain("hotel-booking");
    expect(generation.selected).not.toContain("navigation");
    expect(generation.fieldAnswers["hotel-booking.hotel-name"]).toBe("PROCESS");
    expect(getQuestionnaireFeature("hotel-service", "hotel-booking")?.title).toBe("酒店预订与入住安排");

    const paymentForm = createDevelopmentProjectFormData("online-payment");
    const paymentGeneration = toGenerationForm(paymentForm, "online-payment");
    expect(paymentForm.profile.productName).toBe("示例网络支付产品");
    expect(paymentGeneration.selected).toContain("payment-account");
    expect(paymentGeneration.selected).not.toContain("navigation");
    expect(paymentGeneration.fieldAnswers["payment-account.bank-card"]).toBe("PROCESS");
  });

  it("preserves preset extensions across save, reload, and generation", () => {
    const form = createDevelopmentProjectFormData("hotel-service");
    form.processingActivities.push({
      featureKey: "custom:消息通知",
      title: "消息通知",
      kind: "EXTENSION",
      informationItems: ["设备标识信息"],
      informationOther: [],
      purposes: ["发送预订状态通知"],
      purposeOther: "",
    });

    const workspace = toWorkspaceCompatibilityState(form, "hotel-service");
    const generation = toGenerationForm(form, "hotel-service");

    expect(workspace.customFeatures).toContain("消息通知");
    expect(workspace.selected).not.toContain("custom:消息通知");
    expect(generation.customFeatures).toContain("消息通知");
    expect(generation.selected).not.toContain("custom:消息通知");
    expect(generation.customDetails["消息通知"]?.purpose).toBe("发送预订状态通知");
  });
});
