import { mapV1Content } from "@/src/content/map-v1";
import { getAppQuestionnaire } from "@/src/questionnaires";
import type { SupplementAnswer } from "@/src/knowledge/map-cn/schema";
import {
  FORM_SCHEMA_VERSION,
  ProjectFormDataSchema,
  type ProjectFormData,
} from "@/src/workspace/contract";
import { getDevelopmentScenario } from "@/src/workspace/development-scenarios";

const confirmed = (value: string) => ({ value, status: "CONFIRMED" as const });
const yes = (detail: string, slots: SupplementAnswer["slots"] = {}): SupplementAnswer => ({ answer: "YES", detail, slots });
const no = (): SupplementAnswer => ({ answer: "NO", detail: "", slots: {} });

/**
 * 开发和演示期端到端测试数据。它只通过显式开关装载，不属于知识包；
 * 正式上线前必须将 NEXT_PUBLIC_DEV_FORM_DEFAULTS 设为 false。
 */
function createMapDevelopmentProjectDefaults() {
  const selected = mapV1Content.payload.features.map((feature) => feature.key);
  const processedFieldIds = mapV1Content.payload.features.flatMap((feature) =>
    feature.fields.map((field) => `${feature.key}.${field.key}`),
  );
  const fieldAnswers = Object.fromEntries(processedFieldIds.map((fieldId) => [fieldId, "PROCESS" as const]));

  const supplementAnswers: Record<string, SupplementAnswer> = {
    "device-permissions": yes("精确位置仅在用户点击定位或开始导航时申请；相机和相册仅在用户主动提交道路问题图片时申请；通知权限用于导航提醒和服务通知。拒绝某项权限只影响对应功能。"),
    "third-party-services": yes(
      "行迹地图接入高德开放平台定位 SDK，用于地图展示、设备定位和路线规划。SDK 在用户同意隐私政策后加载，只有用户主动使用定位或导航并授权后才发送相关请求。",
      {
        "service-name": confirmed("高德开放平台定位 SDK"),
        "provider-name": confirmed("高德软件有限公司"),
        purpose: confirmed("用于地图展示、设备定位和路线规划"),
        "data-types": confirmed("精确位置信息、IP 地址、设备型号、操作系统版本和网络状态"),
        "initialization-timing": confirmed("用户同意隐私政策后加载；用户点击定位或开始导航并授权定位权限后发送相关请求"),
        "privacy-policy-url": confirmed("https://lbs.amap.com/pages/privacy/"),
      },
    ),
    "storage-locations": yes(
      "搜索历史和最近浏览记录保存在设备本地；账号资料、用户主动开启同步后的收藏地点和历史路线保存在中国境内服务器。期限届满后删除或匿名化。",
      {
        "data-types": confirmed("搜索历史、最近浏览记录、账号资料、云端收藏、历史路线、服务请求日志和安全日志"),
        "storage-location": confirmed("搜索历史和最近浏览记录保存在设备本地；账号资料、云端收藏、历史路线和服务端日志保存在中国境内服务器"),
        retention: confirmed("搜索历史本地保存 90 日；服务请求日志保存 30 日；安全日志保存 180 日；云端收藏和历史路线保存至用户删除或注销账号"),
        "deletion-method": confirmed("期限届满后从主库删除或匿名化；备份数据在下一轮换周期内清理，最长不超过 90 日"),
      },
    ),
    "account-cloud-sync": yes(
      "产品支持手机号验证码登录。云端同步默认关闭，用户主动开启后同步头像、昵称、收藏地点和历史路线，并可随时关闭或删除。",
      {
        "login-method": confirmed("手机号和短信验证码登录"),
        "sync-data": confirmed("头像、昵称、收藏地点和历史路线"),
        "activation-condition": confirmed("云端同步默认关闭，由用户登录后主动开启"),
        "disable-path": confirmed("我的—设置—云端同步；关闭后不再上传新增记录，不影响本地地图浏览和导航"),
        "deletion-rule": confirmed("用户可在云端同步页面删除记录，也可注销账号；注销完成后删除账号资料和云端同步数据，依法需要留存的除外"),
      },
    ),
    "background-location": yes(
      "只有用户主动开始导航后才启动持续定位；导航结束、退出导航页面或关闭定位权限后立即停止。实时位置不长期保存，脱敏故障日志保存 7 日。",
      {
        trigger: confirmed("用户主动开始导航后"),
        "screen-state": confirmed("仅导航期间在后台或锁屏时继续获取；退出导航后立即停止"),
        frequency: confirmed("根据导航状态动态获取"),
        purpose: confirmed("持续导航；转向播报；路线偏离提醒"),
        retention: confirmed("不保存实时位置；仅保存去标识化故障日志"),
        "disable-path": confirmed("结束导航后停止；关闭位置权限后停止"),
      },
    ),
    "third-party-initialization": yes("高德开放平台定位 SDK 在用户同意隐私政策后加载；只有用户点击定位或开始导航并授权位置权限后，才发送定位或路线规划请求。"),
    "history-and-favorites": yes("保存搜索关键词、浏览地点、收藏地点和历史路线，用于展示最近记录和用户主动开启的云端同步；用户可在“我的—历史与收藏”查看或删除。"),
    "personalized-content": yes(
      "个性化地点推荐默认关闭。用户主动开启后，产品使用最近浏览的地点类别、点击记录和当前城市调整首页推荐和搜索排序。",
      {
        "input-data": confirmed("最近浏览的地点类别、点击记录和当前城市"),
        purpose: confirmed("调整首页地点推荐和搜索结果排序，不用于精确位置广告投放"),
        "output-scene": confirmed("首页地点推荐模块和搜索结果页"),
        "opt-out-path": confirmed("我的—设置—隐私中心—个性化推荐"),
        "opt-out-impact": confirmed("关闭后仍可使用定位、地图浏览、搜索和导航；页面展示通用内容并按非个性化规则排序"),
      },
    ),
    "diagnostic-logs": yes("App 发生闪退或运行异常时收集崩溃时间、设备型号、系统版本、App 版本、IP 地址和错误日志，用于故障定位；日志不包含出发地、到达地或精确位置，保存 90 日。"),
    "notification-push": yes("用户开启通知权限后发送导航转向提醒、路线异常提醒和服务状态通知；不发送营销推送。用户可在 App 消息设置或系统通知设置中关闭。"),
    "customer-service-records": yes("用户联系客服时可主动提供联系方式、问题描述、截图和诊断日志。材料用于处理咨询、投诉和故障，一般保存 180 日；可通过历史反馈页或隐私邮箱申请删除。"),
    "cookies-local-storage": yes("App 使用本地缓存保存地图瓦片、登录状态和用户设置；用户可在“我的—设置—清理缓存”中清除。内嵌网页使用必要 Cookie 维持会话，不用于跨产品广告追踪。"),
    "sensitive-information": yes("产品在用户主动使用定位和导航时处理精确位置及可能形成的行踪轨迹，用于定位、路线规划和持续导航。关闭定位权限后实时定位和导航不可用，但可手动输入地点查询路线。"),
    "user-control-paths": yes("用户可在“我的—设置—隐私中心”查看和删除历史记录、关闭云端同步和个性化推荐、管理设备权限；可在“账号与安全”注销账号；隐私请求在完成身份核验后 15 个工作日内答复。"),
    "sharing-transfer-public": no(),
    "shutdown-data-handling": yes("停止运营时通过 App 公告和站内消息提前通知，停止新增收集；主库数据按公告期限删除或匿名化，备份数据在最长 90 日的轮换周期内清理，依法需要保存的记录除外。"),
  };

  return {
    profile: {
      operatorName: "杭州行迹科技有限公司",
      operatorContact: "浙江省杭州市西湖区示例路 88 号",
      productName: "行迹地图",
      platform: "Android、HarmonyOS",
      productVersion: "2.4.0",
      releaseDate: "2026-08-20",
      contactEmail: "privacy@example.com",
      contactPhone: "400-000-0000",
      rightsEntry: "App 内「我的—设置—隐私中心」",
      rightsResponsePeriod: "收到申请后 15 个工作日内回复",
      policyEntry: "App 内「我的—设置—隐私政策」",
      minorProcessing: "产品不以未成年人为主要服务对象",
      securityMeasures: "HTTPS 传输、访问权限分级、最小权限控制、操作日志审计、数据备份、数据库敏感字段脱敏",
      incidentChannel: "App 弹窗",
      policyEffectiveDate: "2026-08-20",
      policyUpdateNotice: "隐私政策页面提示",
    },
    selected,
    customFeatures: [],
    customDetails: {},
    activityDetails: {
      navigation: { purpose: "确定当前位置；路线规划；实时导航与路线偏离提醒；辅助室内停车场定位" },
      traffic: { purpose: "展示道路拥堵情况；优化路线计算；提供交通事件提醒；生成道路异常热力图" },
      discovery: { purpose: "展示地点和附近服务；提供地点搜索；展示最近浏览内容；展示用户订阅地点的状态更新" },
      support: { purpose: "回复咨询或投诉；核验用户身份；定位和处理产品故障；跟进用户主动提交的道路问题" },
      security: { purpose: "保障账号与服务安全；识别异常请求；排查崩溃和运行故障；识别批量抓取地图数据的异常行为" },
    },
    processingActivities: mapV1Content.payload.features.map((feature) => ({
      featureKey: feature.key,
      title: feature.title,
      kind: (["navigation", "traffic", "discovery"].includes(feature.key) ? "BASIC" : "EXTENSION") as "BASIC" | "EXTENSION",
      informationItems: feature.fields.map((field) => field.label),
      informationOther: ({
        navigation: ["蓝牙信标信息"],
        traffic: ["道路异常上报位置"],
        discovery: ["订阅地点信息"],
        support: ["道路问题工单编号"],
        security: ["异常请求特征"],
      } as Record<string, string[]>)[feature.key] ?? [],
      purposes: [],
      purposeOther: ({
        navigation: "确定当前位置；路线规划；实时导航与路线偏离提醒；辅助室内停车场定位",
        traffic: "展示道路拥堵情况；优化路线计算；提供交通事件提醒；生成道路异常热力图",
        discovery: "展示地点和附近服务；提供地点搜索；展示最近浏览内容；展示用户订阅地点的状态更新",
        support: "回复咨询或投诉；核验用户身份；定位和处理产品故障；跟进用户主动提交的道路问题",
        security: "保障账号与服务安全；识别异常请求；排查崩溃和运行故障；识别批量抓取地图数据的异常行为",
      } as Record<string, string>)[feature.key] ?? "",
    })),
    confirmedFields: processedFieldIds,
    fieldAnswers,
    additionalNotes: "行迹地图当前版本不提供网约车、支付、社区发布或境外服务。产品功能以地图浏览、地点搜索、定位、路线规划、实时导航、实时路况、收藏同步、客服反馈和安全保障为主。所有设备权限均在用户触发对应功能时申请。",
    supplementAnswers,
    permissions: [
      { key: "location", label: "位置权限", scenes: ["展示当前位置", "地点搜索与路线规划", "实时导航", "提供实时路况"], sceneOther: "在地下停车场连接蓝牙信标时辅助室内定位" },
      { key: "camera", label: "相机权限", scenes: ["拍摄并上传图片"], sceneOther: "仅在用户主动提交道路问题图片时申请" },
      { key: "photos", label: "相册/存储权限", scenes: ["选择并上传图片", "提交客服材料"], sceneOther: "仅在用户主动选择问题材料时申请" },
      { key: "notifications", label: "通知权限", scenes: ["导航提醒", "服务状态通知"], sceneOther: "用户可在系统设置中关闭" },
      { key: "custom:bluetooth", label: "蓝牙权限", scenes: [], sceneOther: "在地下停车场连接蓝牙信标并辅助室内定位" },
    ],
    partners: [{
      kind: "SDK" as const,
      name: "高德开放平台定位 SDK",
      provider: "高德软件有限公司",
      purposes: ["地图定位", "路线规划"],
      informationItems: ["位置信息", "设备标识信息", "网络信息", "应用运行信息", "精确位置信息", "蓝牙信标信息"],
      permissions: ["位置权限", "蓝牙权限"],
      trigger: "用户同意隐私政策后加载；点击定位或开始导航并授权后发送请求",
      privacyUrl: "https://lbs.amap.com/pages/privacy/",
    }],
    storageAndSecurity: {
      locations: ["CN" as const, "DEVICE" as const, "CLOUD" as const],
      crossBorderDetail: "",
      retentionPolicies: ["MINIMUM_NECESSARY" as const, "FIXED_PERIOD" as const, "UNTIL_DELETION_OR_CLOSURE" as const, "LEGAL_REQUIREMENT" as const],
      fixedPeriod: "搜索历史本地保存 90 日；服务请求日志保存 30 日；安全日志保存 180 日",
      expiryActions: ["DELETE" as const, "ANONYMIZE" as const, "OTHER" as const],
      expiryOther: "备份数据在最长 90 日的轮换周期内完成清理",
      securityMeasures: ["HTTPS 传输", "访问权限分级", "最小权限控制", "操作日志审计", "数据备份"],
    },
    rightsAndGovernance: {
      rightsEntry: "App 内「我的—设置—隐私中心」",
      responsePeriod: "收到申请后 15 个工作日内回复",
      contactEmail: "privacy@example.com",
      contactPhone: "400-000-0000",
      policyEntry: "App 内「我的—设置—隐私政策」",
      updateNotices: ["App 弹窗", "隐私政策页面"],
      minorMode: "ADULT_ONLY" as const,
    },
    attachments: [],
  };
}

export function createDevelopmentProjectDefaults(categoryKey = "map-navigation") {
  if (categoryKey === "map-navigation") return createMapDevelopmentProjectDefaults();

  const questionnaire = getAppQuestionnaire(categoryKey);
  const scenario = getDevelopmentScenario(categoryKey);
  if (!scenario) throw new Error(`DEVELOPMENT_SCENARIO_NOT_CONFIGURED:${categoryKey}`);
  const processingActivities = questionnaire.features
    .filter((item) => item.defaultSelection)
    .map((item, index) => ({
      featureKey: item.key,
      title: item.title,
      kind: item.kind,
      informationItems: item.fields.map((itemField) => itemField.label),
      informationOther: index === 0 ? [scenario.extraInformation] : [],
      purposes: item.purposes,
      purposeOther: "",
    }));
  const selected = processingActivities.map((item) => item.featureKey);
  const confirmedFields = questionnaire.features
    .filter((item) => selected.includes(item.key))
    .flatMap((item) => item.fields.map((itemField) => `${item.key}.${itemField.key}`));
  const fieldAnswers = Object.fromEntries(confirmedFields.map((key) => [key, "PROCESS" as const]));
  const activityDetails = Object.fromEntries(processingActivities.map((item) => [item.featureKey, { purpose: item.purposes.join("；") }]));
  const permissions = questionnaire.permissionPresets
    .filter((permission) => scenario.permissionKeys.includes(permission.key))
    .map((permission) => ({
      key: permission.key,
      label: permission.label,
      scenes: permission.scenes.slice(0, 3),
      sceneOther: `仅在用户主动使用${questionnaire.basicFunction}的对应场景时申请，可在系统设置中关闭`,
    }));
  const permissionLabels = permissions.map((permission) => permission.label);
  const selectedInformation = [...new Set(processingActivities
    .flatMap((activity) => [...activity.informationItems, ...activity.informationOther]))];
  const partnerName = `示例${scenario.partnerPurpose}服务 SDK`;
  const partnerProvider = `示例${questionnaire.categoryLabel}技术服务有限公司`;
  const partnerInformation = questionnaire.partnerInformationPresets.slice(0, 4);
  const partners = [{
    kind: "SDK" as const,
    name: partnerName,
    provider: partnerProvider,
    purposes: [scenario.partnerPurpose],
    informationItems: partnerInformation,
    permissions: permissionLabels.slice(0, 2),
    trigger: `用户同意隐私政策后加载；仅在用户主动使用${questionnaire.basicFunction}时按需调用`,
    privacyUrl: `https://example.com/privacy/${categoryKey}`,
  }];
  const hasAccountFeature = processingActivities.some((activity) => activity.featureKey.includes("account") || activity.title.includes("账号"));
  const usesNotifications = scenario.permissionKeys.includes("notifications");
  const usesLocalStorage = ["browser", "input-method", "security-management", "camera-beauty", "practical-tools"].includes(categoryKey);
  const supplementAnswers: Record<string, SupplementAnswer> = {
    "device-permissions": yes(`产品使用${permissionLabels.join("、")}；仅在用户主动触发相应功能时申请，拒绝授权只影响对应功能。`),
    "third-party-services": yes(`产品接入${partnerName}，由${partnerProvider}提供，用于${scenario.partnerPurpose}。`, {
      "service-name": confirmed(partnerName),
      "provider-name": confirmed(partnerProvider),
      purpose: confirmed(scenario.partnerPurpose),
      "data-types": confirmed(partnerInformation.join("、")),
      "initialization-timing": confirmed(`用户同意隐私政策后加载；仅在主动使用${questionnaire.basicFunction}时按需调用`),
      "privacy-policy-url": confirmed(`https://example.com/privacy/${categoryKey}`),
    }),
    "storage-locations": yes(`产品信息保存在中华人民共和国境内服务器${usesLocalStorage ? "和用户设备本地" : ""}，并按分类保存规则处理。`, {
      "data-types": confirmed(selectedInformation.join("、")),
      "storage-location": confirmed(`中华人民共和国境内服务器${usesLocalStorage ? "；部分用户设置和内容保存在设备本地" : ""}`),
      retention: confirmed(scenario.retentionSummary),
      "deletion-method": confirmed("期限届满后删除或匿名化，备份数据随轮换周期清理"),
    }),
    "account-cloud-sync": hasAccountFeature
      ? yes(`产品支持手机号验证码登录；账号资料和用户主动保存的${questionnaire.categoryLabel}服务记录可在登录设备间同步，用户可在账号设置中关闭同步或删除。`, {
        "login-method": confirmed("手机号和短信验证码登录"),
        "sync-data": confirmed(`账号资料和用户主动保存的${questionnaire.categoryLabel}服务记录`),
        "activation-condition": confirmed("用户登录后主动使用保存或同步功能时开启"),
        "disable-path": confirmed("我的—设置—账号与同步；关闭后不再同步新增记录"),
        "deletion-rule": confirmed("用户可在账号设置中删除同步数据或注销账号；依法需要留存的记录除外"),
      })
      : no(),
    "third-party-initialization": yes(`${partnerName}在用户同意隐私政策后加载；只有用户主动使用${questionnaire.basicFunction}的对应功能时才按需发送请求。`),
    "notification-push": usesNotifications
      ? yes(`用户开启通知权限后，产品发送与${questionnaire.basicFunction}有关的服务状态和必要提醒；可在消息设置或系统设置中关闭。`)
      : no(),
    "cookies-local-storage": usesLocalStorage
      ? yes("产品使用设备本地缓存保存用户设置、服务状态和用户主动保存的内容；用户可在产品设置或系统设置中清理。")
      : no(),
    "sensitive-information": questionnaire.features.some((item) => item.fields.some((itemField) => [
      "document", "identity", "driver-license", "location", "trajectory", "health", "condition",
      "voice-video", "bank-card", "credit", "face", "biometric",
    ].some((keyword) => itemField.key.includes(keyword))))
      ? yes(`产品仅在用户使用${questionnaire.basicFunction}时处理表单中已勾选的相关信息，并用于对应服务。`)
      : no(),
    "user-control-paths": yes("用户可在“我的—设置—隐私中心”提交查阅、更正、删除、撤回同意或注销账号请求。"),
    "sharing-transfer-public": no(),
    "shutdown-data-handling": yes("停止运营时通过 App 公告提前通知，停止新增收集，并按公告期限删除或匿名化相关信息，法律法规另有要求的除外。"),
  };
  return {
    profile: {
      operatorName: scenario.operatorName,
      operatorContact: "浙江省杭州市西湖区示例路 88 号",
      productName: scenario.productName,
      platform: scenario.platform,
      productVersion: "1.0.0",
      releaseDate: "2026-08-20",
      contactEmail: "privacy@example.com",
      contactPhone: "400-000-0000",
      rightsEntry: "App 内「我的—设置—隐私中心」",
      rightsResponsePeriod: "收到申请后 15 个工作日内回复",
      policyEntry: "App 内「我的—设置—隐私政策」",
      minorProcessing: scenario.minorMode === "MINORS_WITH_GUARDIAN"
        ? "产品可能向未成年人提供服务，使用相关功能前应取得监护人同意并由监护人指导"
        : "产品不以未成年人为主要服务对象",
      securityMeasures: "HTTPS 传输、访问权限分级、最小权限控制、操作日志审计、数据备份",
      incidentChannel: "App 弹窗和站内消息",
      policyEffectiveDate: "2026-08-20",
      policyUpdateNotice: "App 弹窗和隐私政策页面提示",
    },
    selected,
    customFeatures: [],
    customDetails: {},
    activityDetails,
    processingActivities,
    confirmedFields,
    fieldAnswers,
    additionalNotes: `${scenario.productName}当前版本以${questionnaire.basicFunction}为主要基本功能。当前内容是${questionnaire.categoryLabel}类开发模拟数据，实际使用时应按产品真实功能逐项修改。`,
    supplementAnswers,
    permissions,
    partners,
    storageAndSecurity: {
      locations: usesLocalStorage
        ? ["CN" as const, "DEVICE" as const, "CLOUD" as const]
        : ["CN" as const, "CLOUD" as const],
      crossBorderDetail: "",
      retentionPolicies: ["MINIMUM_NECESSARY" as const, "FIXED_PERIOD" as const, "UNTIL_DELETION_OR_CLOSURE" as const, "LEGAL_REQUIREMENT" as const],
      fixedPeriod: scenario.retentionSummary,
      expiryActions: ["DELETE" as const, "ANONYMIZE" as const],
      expiryOther: "",
      securityMeasures: ["HTTPS 传输", "访问权限分级", "最小权限控制", "操作日志审计", "数据备份"],
    },
    rightsAndGovernance: {
      rightsEntry: "App 内「我的—设置—隐私中心」",
      responsePeriod: "收到申请后 15 个工作日内回复",
      contactEmail: "privacy@example.com",
      contactPhone: "400-000-0000",
      policyEntry: "App 内「我的—设置—隐私政策」",
      updateNotices: ["App 弹窗", "隐私政策页面提示"],
      minorMode: scenario.minorMode ?? "ADULT_ONLY" as const,
    },
    attachments: [],
  };
}

/**
 * 模拟数据由显式开关控制。开发环境默认开启；生产构建只有明确配置为
 * `true` 时才开启，方便演示部署继续使用，并在正式上线前一处关闭。
 */
export function developmentFormDefaultsEnabled(
  environment = process.env.NODE_ENV,
  configured = process.env.NEXT_PUBLIC_DEV_FORM_DEFAULTS,
): boolean {
  return configured === "true" || (environment === "development" && configured !== "false");
}

/** 创建接口直接持久化的 v2 表单，避免依赖客户端水合后再补写模拟数据。 */
export function createDevelopmentProjectFormData(categoryKey = "map-navigation"): ProjectFormData {
  const defaults = createDevelopmentProjectDefaults(categoryKey);
  return ProjectFormDataSchema.parse({
    schemaVersion: FORM_SCHEMA_VERSION,
    profile: defaults.profile,
    additionalNotes: defaults.additionalNotes,
    supplementAnswers: defaults.supplementAnswers,
    processingActivities: defaults.processingActivities,
    permissions: defaults.permissions,
    partners: defaults.partners,
    storageAndSecurity: defaults.storageAndSecurity,
    rightsAndGovernance: defaults.rightsAndGovernance,
    attachments: defaults.attachments,
  });
}
