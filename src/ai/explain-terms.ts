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

const FALLBACK_EXPLANATIONS: Record<ExplainableTermKey, string> = {
  location: "能够反映设备或用户所在区域的信息，可能包括大致位置或精确位置。请按产品实际获取的精度填写。",
  "precise-location": "可以较准确定位到用户或设备所在地点的信息，通常来自 GPS、基站、Wi-Fi 等定位能力。",
  "background-location": "用户没有停留在当前页面，或应用进入后台后，产品仍继续获取位置信息的情形。",
  trajectory: "由连续的位置点形成、能够反映用户移动路径和活动规律的信息。",
  "device-info": "与手机或其他终端有关的信息，例如设备型号、操作系统版本、网络状态等。",
  "device-identifier": "用于区分设备的标识信息，例如 Android ID、IDFV 或产品自行生成的设备标识。",
  sdk: "由第三方提供并集成到产品中的软件组件，可能帮助实现地图、统计、推送、登录等功能。",
  "third-party": "除本产品运营者和用户之外，参与提供功能或处理信息的其他公司或服务提供者。",
  cookie: "网站或网页功能保存在浏览器中的小型数据，用于维持登录状态、记录偏好或分析使用情况。",
  cache: "为了提升加载速度或离线使用体验，临时保存在用户设备上的数据。",
  personalization: "根据用户的使用记录、偏好或画像，对内容、排序或服务结果进行差异化展示。",
  retention: "个人信息在系统中保留的时间或判断删除时间的具体规则。",
  "user-rights": "用户对其个人信息可以提出的访问、更正、删除、复制、撤回同意或注销账号等请求。",
  "withdraw-consent": "用户取消此前授权处理个人信息的操作；撤回通常不影响撤回前已经进行的处理。",
  "de-identification": "通过技术处理降低信息与特定个人直接关联的程度，但在结合其他信息时仍可能重新识别。",
  anonymization: "经过处理后无法识别到特定个人，并且不能恢复到可识别状态。",
  "sensitive-info": "一旦泄露或被违法使用，容易导致人格尊严受侵害或人身、财产安全受危害的个人信息。",
  "cross-border": "将在中国境内收集的个人信息提供或允许位于境外的接收方访问。",
  "public-disclosure": "向不特定的人公开发布个人信息，使公众可以查看或获取。",
};

export function isExplainableTerm(key: string): boolean {
  return TERM_MAP.has(key);
}

export function termLabel(key: string): string | null {
  return TERM_MAP.get(key) ?? null;
}

export function fallbackTermExplanation(key: string): { term: string; explanation: string } | null {
  if (!isExplainableTerm(key)) return null;
  const typedKey = key as ExplainableTermKey;
  return { term: TERM_MAP.get(typedKey)!, explanation: FALLBACK_EXPLANATIONS[typedKey] };
}
