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

export type AppQuestionnaire = {
  categoryKey: string;
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

export const REGULATION_SOURCE = ["REG-CORE-03"];
export const REFERENCE_SOURCE = ["INDUSTRY-COMMON-OPTION"];

export const field = (
  key: string,
  label: string,
  required = false,
  sourceRefs = REFERENCE_SOURCE,
): QuestionnaireField => ({ key, label, required, sourceRefs: [...sourceRefs] });

export const feature = (
  key: string,
  title: string,
  kind: "BASIC" | "EXTENSION",
  summary: string,
  fields: QuestionnaireField[],
  purposes: string[],
  defaultSelection = kind === "BASIC",
): QuestionnaireFeature => ({ key, title, kind, summary, fields, purposes, defaultSelection });

export const commonAdditionalFeatures: QuestionnairePresetFeature[] = [
  { title: "账号与同步", kind: "EXTENSION", informationItems: ["手机号码", "账号信息", "用户设置", "同步记录"], purposes: ["注册和登录账号", "同步用户主动保存的内容", "在多设备间恢复数据"] },
  { title: "消息通知", kind: "EXTENSION", informationItems: ["设备标识信息", "通知设置", "消息送达记录"], purposes: ["发送服务提醒", "通知订单或服务状态", "展示用户订阅的消息"] },
  { title: "客服与问题反馈", kind: "EXTENSION", informationItems: ["联系方式", "沟通记录", "用户主动提交的材料", "诊断日志"], purposes: ["回复咨询或投诉", "核验用户身份", "定位和处理产品问题"] },
  { title: "安全保障与故障诊断", kind: "EXTENSION", informationItems: ["设备标识信息", "网络信息", "应用运行信息", "日志信息"], purposes: ["保障账号与服务安全", "识别异常请求", "排查崩溃和运行故障"] },
  { title: "个性化展示与推荐", kind: "EXTENSION", informationItems: ["浏览记录", "点击记录", "所在城市", "偏好设置"], purposes: ["展示个性化内容", "优化搜索结果排序", "提供关闭个性化展示的能力"] },
];

export const commonPermissionPresets: PermissionPreset[] = [
  { key: "location", label: "位置权限", description: "仅在使用定位或基于位置的服务时申请", scenes: ["展示当前位置", "查找附近服务", "路线规划", "提供上门或到店服务"] },
  { key: "camera", label: "相机权限", description: "仅在用户主动拍摄或扫码时申请", scenes: ["拍摄并上传图片", "扫码识别", "身份材料拍摄"] },
  { key: "microphone", label: "麦克风权限", description: "仅在语音功能开启时申请", scenes: ["语音搜索", "语音输入", "音视频通话", "客服语音沟通"] },
  { key: "photos", label: "相册/存储权限", description: "用于用户主动选择或保存内容", scenes: ["选择并上传图片", "保存电子凭证", "提交客服材料"] },
  { key: "contacts", label: "通讯录权限", description: "涉及联系人功能时才申请", scenes: ["主动选择联系人", "邀请联系人", "设置紧急联系人"] },
  { key: "notifications", label: "通知权限", description: "用于用户选择接收的提醒", scenes: ["订单或服务提醒", "消息通知", "订阅内容更新"] },
  { key: "sensors", label: "传感器", description: "仅在方向、姿态、运动或健康功能需要时使用", scenes: ["判断设备方向和姿态", "记录运动状态", "改善定位精度"] },
  { key: "clipboard", label: "剪贴板", description: "只处理用户主动复制或粘贴的内容", scenes: ["识别用户复制的订单号或链接", "读取用户主动粘贴的口令"] },
];

export const commonPartnerPurposes = ["登录", "支付", "消息推送", "统计分析", "客服", "安全风控"];
export const commonPartnerInformation = ["设备标识信息", "网络信息", "位置信息", "应用运行信息", "账号信息", "用户主动提交的内容"];

export function buildQuestionnaire(
  categoryKey: string,
  hash: string,
  features: QuestionnaireFeature[],
  options: {
    additionalFeatures?: QuestionnairePresetFeature[];
    permissionKeys?: string[];
    partnerPurposes?: string[];
    partnerInformation?: string[];
    contentVersion?: string;
  } = {},
): AppQuestionnaire {
  const category = getAppCategory(categoryKey);
  if (!category?.formVersion) throw new Error(`QUESTIONNAIRE_CATEGORY_NOT_OPEN:${categoryKey}`);
  const permissionPresets = options.permissionKeys
    ? commonPermissionPresets.filter((item) => options.permissionKeys?.includes(item.key))
    : commonPermissionPresets;
  const hasAccountFeature = features.some((item) => item.key.includes("account") || item.title.includes("账号"));
  const additionalFeatures = options.additionalFeatures
    ?? commonAdditionalFeatures.filter((item) => !hasAccountFeature || item.title !== "账号与同步");
  return {
    categoryKey,
    categoryLabel: category.label,
    basicFunction: category.basicFunction,
    necessaryInfoSummary: category.necessaryInfoSummary,
    formVersion: category.formVersion,
    contentVersion: options.contentVersion ?? `questionnaire-v1.${categoryKey}`,
    contentHash: `sha256:${hash}`,
    features,
    additionalFeatures,
    permissionPresets,
    partnerPurposePresets: options.partnerPurposes ?? commonPartnerPurposes,
    partnerInformationPresets: options.partnerInformation ?? commonPartnerInformation,
  };
}
