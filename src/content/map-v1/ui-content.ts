import { mapV1Content } from "./index";

export type ScenarioStatus = "selected" | "candidate" | "attention";

export type Scenario = {
  id: string;
  title: string;
  group: string;
  summary: string;
  source: string;
  fields: string[];
  status: ScenarioStatus;
  risk?: string;
};

const sourceLabel: Record<string, string> = {
  "REG-map-01": "法规规则",
  "LAWYER-map-v1": "律师整理",
  "REFERENCE-map-01": "代表性政策候选",
};

export const scenarios: Scenario[] = mapV1Content.payload.features.map((feature) => ({
  id: feature.key,
  title: feature.title,
  group: feature.group,
  summary: feature.summary,
  source: feature.sourceRefs.map((ref) => sourceLabel[ref] ?? ref).join(" + "),
  fields: feature.fields.map((field) => field.label),
  status: feature.defaultSelection ? "selected" : feature.riskCode ? "attention" : "candidate",
  risk: feature.key === "traffic" ? "实时路况对位置的处理目的需要客户确认" : feature.key === "discovery" ? "可能包含超出基本导航所需的信息" : feature.key === "security" ? "设备标识符与传感器字段需要重点复核" : feature.key === "support" ? "客服记录保存期限需要客户补充" : undefined,
}));

export const sourceLayers = [
  "法规规则",
  "律师内容包",
  "代表性政策",
  "客户事实",
  "律师法律判断",
];

export const reviewNotes = mapV1Content.payload.reviewNotes;
