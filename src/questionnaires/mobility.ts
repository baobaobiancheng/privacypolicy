import { mapV1Content } from "@/src/content/map-v1";
import { getAppCategory } from "@/src/categories";

export type QuestionnaireField = {
  key: string;
  label: string;
  required: boolean;
  sourceRefs: string[];
};

export type QuestionnaireFeature = {
  key: string;
  title: string;
  kind: "BASIC" | "EXTENSION";
  summary: string;
  defaultSelection: boolean;
  fields: QuestionnaireField[];
  purposes: string[];
};

export type QuestionnairePresetFeature = {
  title: string;
  kind: "EXTENSION";
  informationItems: string[];
  purposes: string[];
};

export type PermissionPreset = {
  key: string;
  label: string;
  description: string;
  scenes: string[];
};

export type MobilityQuestionnaire = {
  categoryKey: MobilityCategoryKey;
  categoryLabel: string;
  basicFunction: string;
  necessaryInfoSummary: string;
  formVersion: string;
  contentVersion: string;
  contentHash: `sha256:${string}`;
  features: QuestionnaireFeature[];
  additionalFeatures: QuestionnairePresetFeature[];
  permissionPresets: PermissionPreset[];
  partnerPurposePresets: string[];
  partnerInformationPresets: string[];
};

export const MOBILITY_CATEGORY_KEYS = [
  "map-navigation",
  "ride-hailing",
  "transport-ticket",
  "travel-service",
  "hotel-service",
  "local-life",
  "vehicle-service",
  "performance-ticket",
] as const;

export type MobilityCategoryKey = (typeof MOBILITY_CATEGORY_KEYS)[number];

const REGULATION_SOURCE = ["REG-CORE-03"];
const REFERENCE_SOURCE = ["INDUSTRY-COMMON-OPTION"];
const field = (key: string, label: string, required = false, sourceRefs = REFERENCE_SOURCE): QuestionnaireField => ({
  key,
  label,
  required,
  sourceRefs: [...sourceRefs],
});
const feature = (
  key: string,
  title: string,
  kind: "BASIC" | "EXTENSION",
  summary: string,
  fields: QuestionnaireField[],
  purposes: string[],
  defaultSelection = kind === "BASIC",
): QuestionnaireFeature => ({ key, title, kind, summary, fields, purposes, defaultSelection });

const commonAdditionalFeatures: QuestionnairePresetFeature[] = [
  { title: "账号与同步", kind: "EXTENSION", informationItems: ["手机号码", "账号信息", "用户设置", "同步记录"], purposes: ["注册和登录账号", "同步用户主动保存的内容", "在多设备间恢复数据"] },
  { title: "消息通知", kind: "EXTENSION", informationItems: ["设备标识信息", "通知设置", "消息送达记录"], purposes: ["发送服务提醒", "通知订单或行程状态", "展示用户订阅的消息"] },
  { title: "客服与问题反馈", kind: "EXTENSION", informationItems: ["联系方式", "沟通记录", "用户主动提交的材料", "诊断日志"], purposes: ["回复咨询或投诉", "核验用户身份", "定位和处理产品问题"] },
  { title: "安全保障与故障诊断", kind: "EXTENSION", informationItems: ["设备标识信息", "网络信息", "应用运行信息", "日志信息"], purposes: ["保障账号与服务安全", "识别异常请求", "排查崩溃和运行故障"] },
  { title: "个性化展示与推荐", kind: "EXTENSION", informationItems: ["浏览记录", "点击记录", "所在城市", "偏好设置"], purposes: ["展示个性化内容", "优化搜索结果排序", "提供关闭个性化展示的能力"] },
];

const commonPermissionPresets: PermissionPreset[] = [
  { key: "location", label: "位置权限", description: "仅在使用定位或基于位置的服务时申请", scenes: ["展示当前位置", "查找附近服务", "路线规划", "行程服务"] },
  { key: "camera", label: "相机权限", description: "仅在用户主动拍摄或扫码时申请", scenes: ["拍摄并上传图片", "扫码识别", "身份材料拍摄"] },
  { key: "microphone", label: "麦克风权限", description: "仅在语音功能开启时申请", scenes: ["语音搜索", "语音输入", "客服语音沟通"] },
  { key: "photos", label: "相册/存储权限", description: "用于用户主动选择或保存内容", scenes: ["选择并上传图片", "保存电子凭证", "提交客服材料"] },
  { key: "contacts", label: "通讯录权限", description: "涉及联系人功能时才申请", scenes: ["主动选择联系人", "设置紧急联系人"] },
  { key: "notifications", label: "通知权限", description: "用于用户选择接收的提醒", scenes: ["订单或行程提醒", "服务状态通知", "订阅消息"] },
  { key: "sensors", label: "传感器", description: "用于方向、姿态或服务状态辅助", scenes: ["判断设备方向和姿态", "改善定位精度", "记录车辆或行程状态"] },
  { key: "clipboard", label: "剪贴板", description: "只处理用户主动复制或粘贴的内容", scenes: ["识别用户复制的订单号或链接", "读取用户主动粘贴的口令"] },
];

const commonPartnerPurposes = ["登录", "支付", "消息推送", "统计分析", "客服", "安全风控"];
const commonPartnerInformation = ["设备标识信息", "网络信息", "位置信息", "应用运行信息", "账号信息", "用户主动提交的内容"];

const mapQuestionnaire: MobilityQuestionnaire = {
  categoryKey: "map-navigation",
  categoryLabel: "地图导航",
  basicFunction: "定位、地图浏览、路线规划与导航",
  necessaryInfoSummary: "位置信息、出发地、到达地",
  formVersion: "map-questionnaire-v2.0.0",
  contentVersion: mapV1Content.contentVersion,
  contentHash: mapV1Content.contentHash as `sha256:${string}`,
  features: mapV1Content.payload.features.map((item) => feature(
    item.key,
    item.title,
    ["navigation", "traffic", "discovery"].includes(item.key) ? "BASIC" : "EXTENSION",
    item.summary,
    item.fields.map((itemField) => ({ key: itemField.key, label: itemField.label, required: itemField.required, sourceRefs: itemField.sourceRefs })),
    ({
      navigation: ["确定当前位置", "路线规划", "实时导航与路线偏离提醒"],
      traffic: ["展示道路拥堵情况", "优化路线计算", "提供交通事件提醒"],
      discovery: ["展示地点和附近服务", "提供地点搜索", "展示最近浏览内容"],
      support: ["回复咨询或投诉", "核验用户身份", "定位和处理产品故障"],
      security: ["保障账号与服务安全", "识别异常请求", "排查崩溃和运行故障"],
    } as Record<string, string[]>)[item.key] ?? [],
    item.defaultSelection,
  )),
  additionalFeatures: [
    commonAdditionalFeatures[0],
    { title: "收藏、发布与分享", kind: "EXTENSION", informationItems: ["收藏地点", "用户发布内容", "分享记录"], purposes: ["保存用户收藏", "发布地点或评价内容", "完成用户主动分享"] },
    commonAdditionalFeatures[1],
    { title: "语音或智能助手", kind: "EXTENSION", informationItems: ["语音内容", "文字指令", "交互记录"], purposes: ["识别用户指令", "提供语音搜索或导航", "回答与产品功能有关的问题"] },
    commonAdditionalFeatures[4],
  ],
  permissionPresets: commonPermissionPresets.map((item) => item.key === "location"
    ? { ...item, description: "定位和地图服务常用权限", scenes: ["展示当前位置", "地点搜索与路线规划", "实时导航", "提供实时路况"] }
    : item),
  partnerPurposePresets: ["地图定位", "路线规划", ...commonPartnerPurposes],
  partnerInformationPresets: commonPartnerInformation,
};

const questionnaires: Record<MobilityCategoryKey, MobilityQuestionnaire> = {
  "map-navigation": mapQuestionnaire,
  "ride-hailing": buildQuestionnaire("ride-hailing", "20cdb0fe13ddb735627d216c9cf9dffebbb037253e45a3b18f9ed489d8af9b54", [
    feature("ride-account", "账号与乘车人信息", "BASIC", "注册账号并识别乘车联系人", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("passenger-contact", "乘车人联系方式")], ["注册和登录账号", "联系乘车人", "发送订单与行程通知"]),
    feature("ride-booking", "叫车与行程匹配", "BASIC", "提交出发地和到达地并匹配车辆", [field("origin", "乘车人出发地", true, REGULATION_SOURCE), field("destination", "乘车人到达地", true, REGULATION_SOURCE), field("location", "乘车人位置信息", true, REGULATION_SOURCE), field("vehicle-order", "订单与车辆信息")], ["发起叫车请求", "匹配附近车辆", "规划接驾和送达路线"]),
    feature("ride-trip", "乘车行程服务", "BASIC", "展示并完成乘车行程", [field("trajectory", "乘车人行踪轨迹", true, REGULATION_SOURCE), field("trip-time", "上下车时间"), field("vehicle-info", "车辆与司机服务信息")], ["提供实时行程服务", "展示车辆位置和预计到达时间", "处理行程异常"]),
    feature("ride-payment", "订单支付与退款", "BASIC", "完成车费支付、退款和对账", [field("payment-time", "支付时间", true, REGULATION_SOURCE), field("payment-amount", "支付金额", true, REGULATION_SOURCE), field("payment-channel", "支付渠道", true, REGULATION_SOURCE), field("invoice-info", "发票信息")], ["完成订单支付", "处理退款和对账", "开具发票"]),
    feature("ride-safety", "行程安全保障", "EXTENSION", "提供紧急联系人、行程分享或安全处置", [field("emergency-contact", "紧急联系人"), field("shared-trip", "行程分享信息"), field("safety-record", "安全事件记录")], ["提供行程安全保障", "联系紧急联系人", "处理安全事件"]),
  ]),
  "transport-ticket": buildQuestionnaire("transport-ticket", "a3eb8e24c4dd5307c10bd3ce3c4958cb009c0561906254f2975113d731422e50", [
    feature("ticket-account", "账号与旅客信息", "BASIC", "注册账号并填写乘车、乘船或乘机人信息", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("passenger-name", "旅客姓名", true, REGULATION_SOURCE), field("document", "证件类型和号码", true, REGULATION_SOURCE), field("passenger-type", "旅客类型", true, REGULATION_SOURCE)], ["注册和登录账号", "核验旅客身份", "适用相应票务规则"]),
    feature("ticket-search", "班次查询与票务预订", "BASIC", "查询并预订交通班次和席位", [field("origin", "旅客出发地", true, REGULATION_SOURCE), field("destination", "旅客目的地", true, REGULATION_SOURCE), field("departure-time", "出发时间", true, REGULATION_SOURCE), field("service-number", "车次、船次或航班号", true, REGULATION_SOURCE), field("seat-class", "席别或舱位等级", true, REGULATION_SOURCE), field("seat-number", "座位号（如有）", true, REGULATION_SOURCE)], ["查询可售班次", "预订交通票务", "分配席位或舱位"]),
    feature("ticket-itinerary", "改签、退票与行程管理", "BASIC", "管理已购票务和行程变化", [field("order-info", "票务订单信息"), field("change-refund", "改签和退票记录"), field("itinerary", "行程信息")], ["展示和管理行程", "办理改签或退票", "发送行程变化提醒"]),
    feature("ticket-payment", "票款支付与退款", "BASIC", "完成票款支付、退款和对账", [field("payment-time", "支付时间", true, REGULATION_SOURCE), field("payment-amount", "支付金额", true, REGULATION_SOURCE), field("payment-channel", "支付渠道", true, REGULATION_SOURCE)], ["完成票款支付", "处理退款和对账"]),
    feature("etc-service", "ETC 服务", "EXTENSION", "办理或使用 ETC 相关服务", [field("plate-number", "车牌号", true, REGULATION_SOURCE), field("plate-color", "车牌颜色", true, REGULATION_SOURCE), field("etc-order", "ETC 服务订单信息")], ["办理 ETC 服务", "识别服务车辆", "管理 ETC 订单"]),
  ]),
  "travel-service": buildQuestionnaire("travel-service", "3401487d7dc5d0a5cb14a3caa1e684661e4153276a6b3e373beaae37188a21c6", [
    feature("travel-account", "账号与出行人信息", "BASIC", "注册账号并填写实际出行人信息", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("traveler-name", "出行人姓名", true, REGULATION_SOURCE), field("document", "证件类型和号码", true, REGULATION_SOURCE), field("traveler-contact", "出行人联系方式", true, REGULATION_SOURCE)], ["注册和登录账号", "核验出行人身份", "联系出行人"]),
    feature("travel-product", "旅游产品浏览与咨询", "BASIC", "浏览、筛选和咨询旅游服务产品", [field("search-record", "搜索和浏览记录"), field("departure-city", "出发城市"), field("preference", "旅游偏好")], ["展示旅游产品", "提供搜索和筛选", "回复产品咨询"]),
    feature("travel-booking", "旅游产品订购", "BASIC", "选择目的地和时间并提交旅游订单", [field("destination", "旅游目的地", true, REGULATION_SOURCE), field("travel-time", "旅游时间", true, REGULATION_SOURCE), field("booking-info", "订单和产品信息")], ["创建旅游服务订单", "安排旅游产品和行程", "发送订单通知"]),
    feature("travel-payment", "订单支付与退款", "EXTENSION", "完成旅游订单支付和退款", [field("payment-info", "支付信息"), field("refund-info", "退款信息"), field("invoice-info", "发票信息")], ["完成订单支付", "处理退款和对账", "开具发票"]),
  ]),
  "hotel-service": buildQuestionnaire("hotel-service", "c22950665c8f482f99419a014a137ef5e294ae84b3df04901d13cb31cd98d3e0", [
    feature("hotel-account", "账号与住宿人信息", "BASIC", "注册账号并填写实际住宿人信息", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("guest-name", "住宿人姓名", true, REGULATION_SOURCE), field("guest-contact", "住宿人联系方式", true, REGULATION_SOURCE)], ["注册和登录账号", "核验预订人和住宿人信息", "联系住宿人"]),
    feature("hotel-search", "酒店搜索与筛选", "BASIC", "按城市、日期和条件查找酒店", [field("search-city", "搜索城市或位置"), field("search-record", "搜索和浏览记录"), field("preference", "住宿偏好")], ["展示可预订酒店", "提供搜索和筛选", "展示最近浏览内容"]),
    feature("hotel-booking", "酒店预订与入住安排", "BASIC", "选择酒店和日期并提交预订", [field("check-in", "入住时间", true, REGULATION_SOURCE), field("check-out", "退房时间", true, REGULATION_SOURCE), field("hotel-name", "入住酒店名称", true, REGULATION_SOURCE), field("room-order", "房型和订单信息")], ["创建酒店预订", "安排入住和退房", "发送预订状态通知"]),
    feature("hotel-payment", "房费支付与退款", "EXTENSION", "完成房费支付、担保和退款", [field("payment-info", "支付信息"), field("guarantee-info", "订单担保信息"), field("invoice-info", "发票信息")], ["完成订单支付或担保", "处理退款和对账", "开具发票"]),
  ]),
  "local-life": buildQuestionnaire("local-life", "7fd2308c5469f6281f20ab9170011d9629c43e0cbf735cffe26303ea38010e13", [
    feature("local-account", "账号注册与联系", "BASIC", "注册账号并接收服务通知", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account-info", "账号信息")], ["注册和登录账号", "核验账号身份", "发送服务通知"]),
    feature("local-search", "生活服务浏览与搜索", "BASIC", "浏览和查找家政、维修、装修或闲置交易服务", [field("search-record", "搜索和浏览记录"), field("service-location", "服务位置"), field("preference", "服务偏好")], ["展示生活服务", "提供搜索和筛选", "查找附近服务"]),
    feature("local-order", "预约、下单与履约", "BASIC", "预约服务并联系服务人员", [field("contact", "联系人和联系方式"), field("service-address", "服务地址"), field("order-info", "预约和订单信息"), field("submitted-content", "用户主动提交的服务需求")], ["创建和履行服务订单", "联系客户并上门服务", "处理订单变化"]),
    feature("local-payment", "订单支付与退款", "EXTENSION", "完成服务订单支付和退款", [field("payment-info", "支付信息"), field("refund-info", "退款信息")], ["完成订单支付", "处理退款和对账"]),
    feature("local-publish", "信息发布与互动", "EXTENSION", "发布闲置物品或服务需求并进行沟通", [field("published-content", "用户发布的内容"), field("communication", "沟通记录"), field("media", "用户上传的图片或视频")], ["发布和展示用户内容", "促成服务沟通", "处理违规内容"]),
  ]),
  "vehicle-service": buildQuestionnaire("vehicle-service", "69e3df0a8c7e9a5f20595ade89fea3ee0a85974aed527c35bde204d7305e08e7", [
    feature("vehicle-account", "账号注册与联系", "BASIC", "注册账号并接收用车服务通知", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account-info", "账号信息")], ["注册和登录账号", "核验账号身份", "联系用车人"]),
    feature("vehicle-qualification", "共享汽车或租赁汽车资格核验", "BASIC", "在使用共享汽车或租赁汽车时核验驾驶资格", [field("document", "证件类型和号码", true, REGULATION_SOURCE), field("driver-license", "驾驶证件信息", true, REGULATION_SOURCE)], ["核验共享汽车或租赁汽车用车资格", "办理车辆租赁手续"], false),
    feature("vehicle-booking", "车辆浏览与预订", "BASIC", "浏览可用车辆并创建用车订单", [field("vehicle-info", "车辆信息"), field("booking-info", "预订和订单信息")], ["展示可用车辆", "创建用车订单", "安排取还车"]),
    feature("vehicle-nearby", "附近共享单车或分时租赁车辆", "BASIC", "根据当前位置查找附近可用车辆", [field("location", "位置信息", true, REGULATION_SOURCE)], ["查找附近可用车辆", "展示取还车地点"], false),
    feature("vehicle-usage", "开锁、取还与行程服务", "BASIC", "完成共享单车、共享汽车或租赁汽车使用", [field("unlock-record", "开锁和关锁记录"), field("trip-record", "用车行程记录"), field("return-location", "取还车位置")], ["完成车辆开锁和归还", "记录用车服务状态", "处理异常订单"]),
    feature("vehicle-payment", "费用支付与退款", "BASIC", "完成用车费用支付、押金和退款", [field("payment-time", "支付时间", true, REGULATION_SOURCE), field("payment-amount", "支付金额", true, REGULATION_SOURCE), field("payment-channel", "支付渠道", true, REGULATION_SOURCE), field("deposit", "押金信息")], ["完成费用支付", "处理押金和退款", "进行订单对账"]),
  ]),
  "performance-ticket": buildQuestionnaire("performance-ticket", "5e5152e64b3a4d75afad1694ca311554f1f910d128d6bba4311e8ffdf0d335eb", [
    feature("show-account", "账号注册与联系", "BASIC", "注册账号并接收购票通知", [field("mobile", "注册用户移动电话号码", true, REGULATION_SOURCE), field("account-info", "账号信息")], ["注册和登录账号", "核验购票账号", "发送票务通知"]),
    feature("show-search", "演出浏览与选场", "BASIC", "浏览演出并选择观演场次", [field("view-record", "搜索和浏览记录"), field("show-session", "观演场次", true, REGULATION_SOURCE), field("venue", "演出场馆信息")], ["展示演出信息", "提供搜索和筛选", "选择观演场次"]),
    feature("show-booking", "选座与购票", "BASIC", "选择座位并提交购票订单", [field("seat-number", "座位号（如有）", true, REGULATION_SOURCE), field("ticket-order", "票务订单信息"), field("attendee-info", "观演人信息")], ["创建购票订单", "分配或确认座位", "生成电子票或取票凭证"]),
    feature("show-payment", "票款支付与退款", "BASIC", "完成票款支付和退款", [field("payment-time", "支付时间", true, REGULATION_SOURCE), field("payment-amount", "支付金额", true, REGULATION_SOURCE), field("payment-channel", "支付渠道", true, REGULATION_SOURCE)], ["完成票款支付", "处理退款和对账"]),
    feature("show-admission", "实名观演与入场核验", "EXTENSION", "在实际采用实名制时核验观演人和入场凭证", [field("attendee-name", "观演人姓名"), field("attendee-document", "观演人证件信息"), field("admission-record", "验票和入场记录")], ["落实实名购票或观演要求", "核验入场资格", "处理票务异常"]),
  ]),
};

function buildQuestionnaire(categoryKey: Exclude<MobilityCategoryKey, "map-navigation">, hash: string, features: QuestionnaireFeature[]): MobilityQuestionnaire {
  const category = getAppCategory(categoryKey);
  if (!category) throw new Error(`MOBILITY_CATEGORY_NOT_FOUND:${categoryKey}`);
  return {
    categoryKey,
    categoryLabel: category.label,
    basicFunction: category.basicFunction,
    necessaryInfoSummary: category.necessaryInfoSummary,
    formVersion: "mobility-questionnaire-v1.0.0",
    contentVersion: `mobility-v1.${categoryKey}`,
    contentHash: `sha256:${hash}`,
    features,
    additionalFeatures: commonAdditionalFeatures,
    permissionPresets: commonPermissionPresets,
    partnerPurposePresets: categoryKey === "ride-hailing"
      ? ["车辆定位", "订单支付", "消息推送", "行程安全", "统计分析", "客服", "安全风控"]
      : categoryKey === "vehicle-service"
        ? ["车辆定位", "车辆开锁", "订单支付", "消息推送", "统计分析", "客服", "安全风控"]
        : commonPartnerPurposes,
    partnerInformationPresets: commonPartnerInformation,
  };
}

export function isMobilityCategoryKey(value: string): value is MobilityCategoryKey {
  return (MOBILITY_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function getMobilityQuestionnaire(categoryKey: string): MobilityQuestionnaire {
  if (!isMobilityCategoryKey(categoryKey)) throw new Error(`QUESTIONNAIRE_NOT_AVAILABLE:${categoryKey}`);
  return questionnaires[categoryKey];
}

export function getQuestionnaireFeature(categoryKey: string, featureKey: string) {
  return getMobilityQuestionnaire(categoryKey).features.find((item) => item.key === featureKey);
}

export function getQuestionnaireScenarios(categoryKey: string) {
  return getMobilityQuestionnaire(categoryKey).features.map((item) => ({
    id: item.key,
    title: item.title,
    group: item.kind === "BASIC" ? "基本功能" : "扩展功能",
    summary: item.summary,
    fields: item.fields.map((itemField) => itemField.label),
    status: item.defaultSelection ? "selected" as const : "candidate" as const,
  }));
}
