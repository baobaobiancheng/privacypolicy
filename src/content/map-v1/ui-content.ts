import { mapV1Content } from "./index";

export type ScenarioStatus = "selected" | "candidate" | "attention";

export type Scenario = {
  id: string;
  title: string;
  group: string;
  summary: string;
  fields: string[];
  status: ScenarioStatus;
  risk?: string;
};

export const scenarios: Scenario[] = mapV1Content.payload.features.map((feature) => ({
  id: feature.key,
  title: feature.title,
  group: feature.key === "navigation" ? "基本功能 · 必要信息基线" : `扩展功能 · ${feature.group}`,
  summary: feature.summary,
  fields: feature.fields.map((field) => field.label),
  status: feature.defaultSelection ? "selected" : feature.riskCode ? "attention" : "candidate",
  risk: feature.key === "traffic" ? "实时路况对位置的处理目的需要客户确认" : feature.key === "discovery" ? "可能包含超出基本导航所需的信息" : feature.key === "security" ? "设备标识符与传感器字段需要重点复核" : feature.key === "support" ? "客服记录保存期限需要客户补充" : undefined,
}));

export const reviewNotes = mapV1Content.payload.reviewNotes;
