"use client";

import { ArrowLeft, ArrowRight, CaretRight, Check, Plus } from "@phosphor-icons/react";
import type { MobilityQuestionnaire, QuestionnairePresetFeature } from "@/src/questionnaires/mobility";
import { getQuestionnaireScenarios } from "@/src/questionnaires/mobility";
import type { ProjectData } from "../workspace-model";

type Scenario = ReturnType<typeof getQuestionnaireScenarios>[number];
type PresetFeature = QuestionnairePresetFeature;
type DraftField = { id: string; label: string; selected: boolean; featureId: string };
type Props = {
  data: ProjectData;
  questionnaire: MobilityQuestionnaire;
  scenarios: Scenario[];
  basicFeatureIds: Set<string>;
  selectedScenarios: Scenario[];
  selectedCustomFeatures: string[];
  draftFields: DraftField[];
  customOpen: boolean;
  customName: string;
  canContinue: boolean;
  onToggleFeature: (id: string) => void;
  onTogglePresetFeature: (feature: PresetFeature) => void;
  onSetCustomOpen: (open: boolean) => void;
  onSetCustomName: (name: string) => void;
  onAddCustomFeature: () => void;
  onRemoveCustomFeature: (name: string) => void;
  onToggleField: (id: string) => void;
  onUpdateInformationOther: (featureKey: string, title: string, kind: "BASIC" | "EXTENSION" | "CUSTOM", value: string) => void;
  onTogglePurposePreset: (id: string, purpose: string) => void;
  onUpdatePurposeOther: (id: string, value: string) => void;
  onToggleCustomInformationPreset: (feature: string, item: string) => void;
  onToggleCustomPurposePreset: (feature: string, purpose: string) => void;
  onUpdateCustomPurposeOther: (feature: string, value: string) => void;
  onUpdateNotes: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function ProcessingActivitiesStep(props: Props) {
  const { data } = props;
  return <section className="workspace-panel panel-enter">
    <div className="panel-heading"><p>功能与个人信息</p><h2>按功能确认信息和处理目的。</h2><span>先勾选通用选项，表单没有覆盖的内容可以手动补充或上传材料。</span></div>
    <div className="workspace-feature-list">
      {props.scenarios.map((scenario) => { const checked = data.selected.includes(scenario.id); return <button key={scenario.id} type="button" className="workspace-feature-card group" data-selected={checked} onClick={() => props.onToggleFeature(scenario.id)}><span className="feature-check">{checked && <Check weight="bold" />}</span><span><strong>{scenario.title}</strong><small>{props.basicFeatureIds.has(scenario.id) ? "基本功能" : "常见扩展功能"}</small></span><CaretRight weight="bold" /></button>; })}
      {props.questionnaire.additionalFeatures.map((feature) => { const checked = data.customFeatures.includes(feature.title); return <button key={feature.title} type="button" className="workspace-feature-card group" data-selected={checked} onClick={() => props.onTogglePresetFeature(feature)}><span className="feature-check">{checked && <Check weight="bold" />}</span><span><strong>{feature.title}</strong><small>常见扩展功能</small></span><CaretRight weight="bold" /></button>; })}
    </div>
    {props.customOpen ? <div className="custom-form"><input autoFocus value={props.customName} onChange={(event) => props.onSetCustomName(event.target.value)} placeholder="例如：收藏常用地点" onKeyDown={(event) => event.key === "Enter" && props.onAddCustomFeature()} /><button type="button" onClick={props.onAddCustomFeature}>添加</button><button type="button" onClick={() => props.onSetCustomOpen(false)}>取消</button></div> : <button type="button" className="add-feature" onClick={() => props.onSetCustomOpen(true)}><Plus weight="bold" /> 添加其他功能</button>}
    <div className="processing-card-list">{props.selectedScenarios.map((scenario) => {
      const fields = props.draftFields.filter((field) => field.featureId === scenario.id);
      const values = data.activityDetails[scenario.id]?.purpose.split("；").filter(Boolean) ?? [];
      const activity = data.processingActivities.find((item) => item.featureKey === scenario.id);
      const purposeOptions = props.questionnaire.features.find((item) => item.key === scenario.id)?.purposes ?? [];
      const otherPurpose = values.filter((value) => !purposeOptions.includes(value)).join("；");
      return <article className="processing-card" key={scenario.id}><div className="processing-card-heading"><div><span>{props.basicFeatureIds.has(scenario.id) ? "基本功能" : "扩展功能"}</span><h3>{scenario.title}</h3></div><button type="button" onClick={() => props.onToggleFeature(scenario.id)}>移除</button></div><div className="processing-block"><strong>1. 选择对应个人信息</strong><div className="preset-chips">{fields.map((field) => <button type="button" key={field.id} data-selected={field.selected} onClick={() => props.onToggleField(field.id)}>{field.selected ? <Check weight="bold" /> : null}{field.label}</button>)}</div><label><span>其他个人信息（可选）</span><textarea rows={3} value={activity?.informationOther.join("、") ?? ""} onChange={(event) => props.onUpdateInformationOther(scenario.id, scenario.title, props.basicFeatureIds.has(scenario.id) ? "BASIC" : "EXTENSION", event.target.value)} placeholder="如有其他情况，请补充说明。" /></label></div><div className="processing-block"><strong>2. 选择处理目的</strong><div className="preset-chips">{purposeOptions.map((purpose) => <button type="button" key={purpose} data-selected={values.includes(purpose)} onClick={() => props.onTogglePurposePreset(scenario.id, purpose)}>{values.includes(purpose) ? <Check weight="bold" /> : null}{purpose}</button>)}</div><label><span>其他处理目的（可选）</span><textarea rows={3} value={otherPurpose} onChange={(event) => props.onUpdatePurposeOther(scenario.id, event.target.value)} placeholder="如有其他情况，请补充说明。" /></label></div></article>;
    })}{props.selectedCustomFeatures.map((feature) => {
      const customActivity = data.processingActivities.find((item) => item.featureKey === `custom:${feature}`);
      const preset = props.questionnaire.additionalFeatures.find((item) => item.title === feature);
      const purposeValues = data.customDetails[feature]?.purpose.split("；").filter(Boolean) ?? [];
      return <article className="processing-card" key={feature}>
        <div className="processing-card-heading"><div><span>{preset ? "扩展功能" : "其他功能"}</span><h3>{feature}</h3></div><button type="button" onClick={() => preset ? props.onTogglePresetFeature(preset) : props.onRemoveCustomFeature(feature)}>移除</button></div>
        <div className="processing-block"><strong>1. 选择对应个人信息</strong>{preset ? <div className="preset-chips">{preset.informationItems.map((item) => <button type="button" key={item} data-selected={customActivity?.informationItems.includes(item)} onClick={() => props.onToggleCustomInformationPreset(feature, item)}>{customActivity?.informationItems.includes(item) ? <Check weight="bold" /> : null}{item}</button>)}</div> : null}<label><span>其他个人信息</span><textarea rows={3} value={customActivity?.informationOther.join("、") ?? ""} onChange={(event) => props.onUpdateInformationOther(`custom:${feature}`, feature, customActivity?.kind ?? (preset?.kind ?? "CUSTOM"), event.target.value)} placeholder="例如：收藏地点、账号信息" /></label></div>
        <div className="processing-block"><strong>2. 选择处理目的</strong>{preset ? <div className="preset-chips">{preset.purposes.map((purpose) => <button type="button" key={purpose} data-selected={purposeValues.includes(purpose)} onClick={() => props.onToggleCustomPurposePreset(feature, purpose)}>{purposeValues.includes(purpose) ? <Check weight="bold" /> : null}{purpose}</button>)}</div> : null}<label><span>其他处理目的（可选）</span><textarea rows={3} value={purposeValues.filter((value) => !preset?.purposes.includes(value as never)).join("；")} onChange={(event) => props.onUpdateCustomPurposeOther(feature, event.target.value)} placeholder="如有其他情况，请补充说明。" /></label></div>
      </article>;
    })}</div>
    <label className="additional-notes"><span>其他补充信息（可选）</span><textarea value={data.additionalNotes} onChange={(event) => props.onUpdateNotes(event.target.value)} placeholder="补充表单没有覆盖、但产品实际存在的功能或处理规则。" /></label>
    <div className="panel-actions"><button type="button" className="button button-ghost" onClick={props.onBack}><ArrowLeft weight="bold" /> 返回基本信息</button><button type="button" className="button button-primary" data-analytics-id="processing.next" disabled={!props.canContinue} onClick={props.onNext}>进入设备权限 <ArrowRight weight="bold" /></button></div>
  </section>;
}
