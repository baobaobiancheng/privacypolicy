import type { PreflightIssue } from "@/src/ai/deepseek";
import type { FieldAnswer } from "@/src/knowledge/readiness";
import type { SupplementAnswer } from "@/src/knowledge/map-cn/schema";
import type { ProjectFormData } from "@/src/workspace/contract";

export const CLIENT_PERSONA_ID = "client-editor";

export const basicProfileFields = [
  ["operatorName", "运营主体全称", "例如：杭州行迹科技有限公司"],
  ["operatorContact", "运营主体联系信息", "例如：浙江省杭州市西湖区××路××号"],
  ["productName", "产品名称", "例如：行迹地图"],
  ["platform", "产品平台", "例如：Android、iOS、Web"],
  ["productVersion", "产品版本", "例如：2.4.0"],
  ["releaseDate", "版本发布日期", "例如：2026-08-20"],
  ["policyEffectiveDate", "隐私政策生效日期", "例如：2026-08-20"],
] as const;

export const rightsProfileFields = [
  ["contactEmail", "隐私联系邮箱", "例如：privacy@example.com"],
  ["contactPhone", "客服电话（可选）", "例如：400-000-0000"],
  ["rightsEntry", "用户权利请求入口", "例如：App 内「我的」-「隐私中心」"],
  ["rightsResponsePeriod", "权利请求响应方式和期限", "例如：收到申请后 15 个工作日内回复"],
  ["policyEntry", "隐私政策查阅入口", "例如：App 内「我的」-「设置」-「隐私政策」"],
  ["minorProcessing", "未成年人信息实际处理情况", "例如：不面向未成年人，发现后删除"],
  ["incidentChannel", "个人信息事件通知渠道", "例如：隐私联系邮箱和 App 公告"],
  ["policyUpdateNotice", "政策更新通知方式", "例如：App 弹窗和隐私政策页提示"],
] as const;

export const profileFields = [...basicProfileFields, ...rightsProfileFields, ["securityMeasures", "安全措施概述", "例如：访问控制、传输加密、最小权限"] as const] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type GeneratedState = { status: "PENDING" | "GENERATING" | "FAILED" | "SUCCEEDED"; generationId: string; message?: string; createdAt: string };
export type GenerationStageKey = "FACT_CHECK" | "LAW_SEARCH" | "DRAFTING" | "FINALIZING";
export type GenerationStageStatus = "WAITING" | "ACTIVE" | "COMPLETED" | "FAILED";
export type GenerationStageItem = { key: GenerationStageKey; label: string; status: GenerationStageStatus; message: string; durationMs?: number };
export type LiveGenerationState = {
  startedAt: number;
  stages: GenerationStageItem[];
  completedSections: number;
  totalSections: number;
  currentSection: string;
  characterCount: number;
  phase: "THINKING" | "WRITING" | "VALIDATED";
  activityCount: number;
};
export type DisplayPreflightIssue = PreflightIssue & { fingerprint: string };
export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedText?: string;
  suggestionTarget?: { kind: "ADDITIONAL_NOTES" | "FEATURE_INFORMATION" | "FEATURE_PURPOSE"; featureName?: string };
  applied?: boolean;
  attachmentNames?: string[];
};
export type AssistantAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "DOCUMENT" | "SPREADSHEET" | "IMAGE" | "TEXT";
  status: "READING" | "READY" | "FAILED";
  content?: string;
  truncated?: boolean;
  error?: string;
  previewUrl?: string;
  useForFormFilling: boolean;
};
export type ActivityDetail = { purpose: string };
export type SnapshotItem = { id: string; state: "SUCCEEDED"; createdAt: string; markdown: string; downloadUrl: string };
export type GenerationJobPayload = {
  id: string;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SUPERSEDED";
  stage: "QUEUED" | GenerationStageKey | "COMPLETED";
  progress: { completedSections?: number; totalSections?: number; currentSection?: string; characterCount?: number; phase?: "THINKING" | "WRITING" | "VALIDATED"; activityCount?: number; message?: string } | null;
  previewMarkdown: string | null;
  error: { code: string; message: string; details?: unknown } | null;
  reportId: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type ProjectData = {
  projectId: string | null;
  revision: number;
  profile: Record<string, string>;
  selected: string[];
  customFeatures: string[];
  customDetails: Record<string, ActivityDetail>;
  additionalNotes: string;
  confirmedFields: string[];
  fieldAnswers: Record<string, FieldAnswer>;
  activityDetails: Record<string, ActivityDetail>;
  supplementAnswers: Record<string, SupplementAnswer>;
  generated?: GeneratedState;
  generatedMarkdown?: string;
  processingActivities: NonNullable<ProjectFormData["processingActivities"]>;
  permissions: NonNullable<ProjectFormData["permissions"]>;
  partners: NonNullable<ProjectFormData["partners"]>;
  storageAndSecurity: NonNullable<ProjectFormData["storageAndSecurity"]>;
  rightsAndGovernance: NonNullable<ProjectFormData["rightsAndGovernance"]>;
  attachments: NonNullable<ProjectFormData["attachments"]>;
};

export const ASSISTANT_EXAMPLES = ["检查当前这一步还缺什么", "根据已上传资料整理可填写内容"] as const;
export const INITIAL_GENERATION_STAGES: GenerationStageItem[] = [
  { key: "FACT_CHECK", label: "检查填写内容", status: "WAITING", message: "等待开始" },
  { key: "LAW_SEARCH", label: "查询相关法规", status: "WAITING", message: "等待填写内容检查完成" },
  { key: "DRAFTING", label: "编写政策正文", status: "WAITING", message: "等待法规资料准备完成" },
  { key: "FINALIZING", label: "核对并制作 Word", status: "WAITING", message: "等待正文编写完成" },
];
export const PURPOSE_PRESETS: Record<string, string[]> = {
  navigation: ["确定当前位置", "路线规划", "实时导航与路线偏离提醒"],
  traffic: ["展示道路拥堵情况", "优化路线计算", "提供交通事件提醒"],
  discovery: ["展示地点和附近服务", "提供地点搜索", "展示最近浏览内容"],
  support: ["回复咨询或投诉", "核验用户身份", "定位和处理产品故障"],
  security: ["保障账号与服务安全", "识别异常请求", "排查崩溃和运行故障"],
};
export const BASIC_FEATURE_IDS = new Set(["navigation", "traffic", "discovery"]);
export const PRESET_ADDITIONAL_FEATURES = [
  { title: "账号与同步", kind: "EXTENSION" as const, informationItems: ["手机号码", "账号信息", "收藏地点", "历史路线"], purposes: ["注册和登录账号", "同步用户主动保存的内容", "在多设备间恢复数据"] },
  { title: "收藏、发布与分享", kind: "EXTENSION" as const, informationItems: ["收藏地点", "用户发布内容", "分享记录"], purposes: ["保存用户收藏", "发布地点或评价内容", "完成用户主动分享"] },
  { title: "消息通知", kind: "EXTENSION" as const, informationItems: ["设备标识信息", "通知设置", "消息送达记录"], purposes: ["发送导航提醒", "通知服务状态", "展示用户订阅的消息"] },
  { title: "语音或智能助手", kind: "EXTENSION" as const, informationItems: ["语音内容", "文字指令", "交互记录"], purposes: ["识别用户指令", "提供语音搜索或导航", "回答与产品功能有关的问题"] },
  { title: "个性化展示与推荐", kind: "EXTENSION" as const, informationItems: ["浏览记录", "点击记录", "所在城市", "偏好设置"], purposes: ["展示个性化地点或内容", "优化搜索结果排序", "提供关闭个性化展示的能力"] },
] as const;
export const PERMISSION_PRESETS = [
  { key: "location", label: "位置权限", description: "定位和地图服务常用权限", scenes: ["展示当前位置", "地点搜索与路线规划", "实时导航", "提供实时路况"] },
  { key: "camera", label: "相机权限", description: "仅在用户主动触发拍摄时申请", scenes: ["拍摄并上传图片", "扫码识别", "AR 导航"] },
  { key: "microphone", label: "麦克风权限", description: "仅在语音功能开启时申请", scenes: ["语音搜索", "语音导航指令", "客服语音沟通"] },
  { key: "photos", label: "相册/存储权限", description: "用于用户主动选择或保存内容", scenes: ["选择并上传图片", "保存地图或路线图片", "提交客服材料"] },
  { key: "contacts", label: "通讯录权限", description: "涉及联系人功能时才需要", scenes: ["主动选择联系人", "设置紧急联系人", "提高语音拨号识别率"] },
  { key: "notifications", label: "通知权限", description: "用于用户选择接收的提醒", scenes: ["导航提醒", "服务状态通知", "订阅消息"] },
  { key: "sensors", label: "传感器", description: "用于方向、姿态或定位辅助", scenes: ["判断设备方向和姿态", "改善定位精度", "记录运动状态"] },
  { key: "clipboard", label: "剪贴板", description: "只处理用户主动复制或粘贴的内容", scenes: ["识别用户复制的地点或链接", "读取用户主动粘贴的口令"] },
] as const;
export const SECURITY_PRESETS = ["HTTPS 传输", "访问权限分级", "最小权限控制", "操作日志审计", "数据备份", "员工保密与安全培训"] as const;
export const PARTNER_PURPOSE_PRESETS = ["登录", "地图定位", "支付", "消息推送", "统计分析", "客服", "安全风控"] as const;
export const PARTNER_INFORMATION_PRESETS = ["设备标识信息", "网络信息", "位置信息", "应用运行信息", "账号信息", "用户主动提交的内容"] as const;
export const PARTNER_PERMISSION_PRESETS = ["位置权限", "相机权限", "麦克风权限", "相册/存储权限", "通知权限"] as const;
export const PLATFORM_PRESETS = ["Android", "iOS", "Web", "微信小程序"] as const;
export const RIGHTS_FIELD_PRESETS: Record<string, readonly string[]> = {
  rightsEntry: ["App 内「我的—设置—隐私中心」", "通过隐私联系邮箱提交", "通过客服电话提交"],
  rightsResponsePeriod: ["收到申请后 15 个工作日内回复", "收到申请后 30 日内回复"],
  policyEntry: ["App 内「我的—设置—隐私政策」", "产品官方网站隐私政策页面"],
  minorProcessing: ["产品不以未成年人为主要服务对象", "产品设置未成年人模式", "产品会在监护人同意后处理未成年人信息"],
  incidentChannel: ["App 弹窗", "站内消息", "电子邮件", "短信", "公告"],
  policyUpdateNotice: ["App 弹窗", "站内消息", "隐私政策页面提示", "电子邮件", "公告"],
};
export const QUESTION_DETAIL_PRESETS: Record<string, readonly string[]> = {
  "notification-push": ["导航提醒", "服务状态通知", "运营消息", "营销推送"],
  "cookies-local-storage": ["必要 Cookie", "本地缓存", "匿名标识符", "WebView 会话信息"],
  "sensitive-information": ["精确位置", "行踪轨迹", "通信内容", "身份证件", "生物识别信息"],
  "third-party-initialization": ["用户同意隐私政策后初始化", "用户使用对应功能时初始化", "用户授权相关权限后发送数据"],
  "sharing-transfer-public": ["委托处理", "共享", "转让", "公开披露"],
  "diagnostic-logs": ["崩溃日志", "性能诊断信息", "设备标识信息", "网络日志"],
  "shutdown-data-handling": ["停止运营通知", "停止新增收集", "主库删除或匿名化", "备份轮换清理"],
  "history-and-favorites": ["搜索记录", "浏览记录", "历史路线", "收藏地点", "常用地点"],
  "customer-service-records": ["联系方式", "沟通记录", "截图", "诊断日志", "问题材料"],
  "user-control-paths": ["查阅", "更正", "删除", "撤回同意", "关闭权限", "注销账号"],
  "custom-feature-data": ["用户主动提交的信息", "设备信息", "日志信息", "位置信息"],
};
export const SLOT_PRESETS: Record<string, Record<string, readonly string[]>> = {
  "background-location": {
    trigger: ["用户主动开始导航后", "用户开启持续定位功能后"],
    "screen-state": ["仅导航期间在后台或锁屏时继续获取", "进入后台或锁屏后停止获取", "退出导航后立即停止"],
    frequency: ["根据导航状态动态获取", "按需获取", "定时获取"],
    purpose: ["持续导航", "转向播报", "路线偏离提醒", "实时路况更新"],
    retention: ["不保存实时位置", "仅保存去标识化故障日志", "按统一保存期限处理"],
    "disable-path": ["结束导航后停止", "关闭位置权限后停止", "退出导航页面后停止"],
  },
  storage: {
    "storage-location": ["中华人民共和国境内服务器", "设备本地", "境内云端服务器"],
    retention: ["提供服务所必需的最短期限", "用户删除相关信息或注销账号前", "法律法规另有要求的期限"],
    "deletion-method": ["删除", "匿名化", "备份数据随轮换周期清理"],
  },
  "account-sync": {
    "login-method": ["手机号码登录", "验证码登录", "第三方账号登录"],
    "sync-data": ["收藏地点", "历史路线", "账号设置", "用户主动上传的内容"],
    "activation-condition": ["用户主动开启", "登录后由用户选择是否同步"],
    "disable-path": ["在账号与同步设置中关闭", "退出账号后停止同步"],
    "deletion-rule": ["用户可主动删除云端数据", "注销账号后按统一规则删除或匿名化"],
  },
  personalization: {
    purpose: ["内容推荐", "搜索结果排序", "路线方案排序"],
    "output-scene": ["首页推荐", "搜索结果页", "地点详情页", "路线方案页"],
    "opt-out-path": ["在隐私设置中关闭", "在个性化推荐设置中关闭"],
    "opt-out-impact": ["不影响基本功能使用", "改为展示非个性化内容"],
  },
};
