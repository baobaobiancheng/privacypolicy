/**
 * 可解释的功能术语白名单（纯数据，客户端与服务端共用）。
 *
 * 既是 UI 的术语清单，也是 /api/explain 的输入白名单：
 * 服务端只允许解释这里的固定术语，不接受任意文本拼进模型提示词，
 * 从源头阻断提示注入。新增术语必须同时出现在本文档与附录名词解释中。
 */
export const EXPLAINABLE_TERMS = [
  { key: "location", label: "位置信息" },
  { key: "precise-location", label: "精确位置" },
  { key: "background-location", label: "后台定位" },
  { key: "trajectory", label: "行踪轨迹" },
  { key: "device-info", label: "设备信息" },
  { key: "device-identifier", label: "设备标识符" },
  { key: "sdk", label: "SDK" },
  { key: "third-party", label: "第三方服务" },
  { key: "cookie", label: "Cookie" },
  { key: "cache", label: "本地缓存" },
  { key: "personalization", label: "个性化推荐" },
  { key: "retention", label: "保存期限" },
  { key: "user-rights", label: "用户权利" },
  { key: "withdraw-consent", label: "撤回同意" },
  { key: "de-identification", label: "去标识化" },
  { key: "anonymization", label: "匿名化" },
  { key: "sensitive-info", label: "敏感个人信息" },
  { key: "cross-border", label: "数据跨境传输" },
  { key: "public-disclosure", label: "公开披露" },
] as const;

export type ExplainableTermKey = (typeof EXPLAINABLE_TERMS)[number]["key"];
export type ExplainableTerm = (typeof EXPLAINABLE_TERMS)[number];

const TERM_MAP = new Map<string, string>(EXPLAINABLE_TERMS.map((term) => [term.key, term.label]));

export function isExplainableTerm(key: string): boolean {
  return TERM_MAP.has(key);
}

export function termLabel(key: string): string | null {
  return TERM_MAP.get(key) ?? null;
}