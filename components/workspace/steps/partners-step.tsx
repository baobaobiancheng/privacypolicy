"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Plus } from "@phosphor-icons/react";
import { PARTNER_PERMISSION_PRESETS, type ProjectData } from "../workspace-model";

type Partner = ProjectData["partners"][number];
type Props = {
  data: ProjectData;
  purposePresets: string[];
  informationPresets: string[];
  renderSupplementQuestion: (questionId: string) => ReactNode;
  onConfirm: (answer: "YES" | "NO") => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<Partner>) => void;
  onTogglePurpose: (index: number, purpose: string) => void;
  onToggleListValue: (index: number, key: "informationItems" | "permissions", value: string) => void;
  onUpdateOtherValues: (index: number, key: "purposes" | "informationItems" | "permissions", presets: readonly string[], value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function PartnersStep(props: Props) {
  const { data } = props;
  const answer = data.supplementAnswers["third-party-services"]?.answer;
  return <section className="workspace-panel panel-enter">
    <div className="panel-heading"><p>SDK 与合作方</p><h2>确认产品接入的第三方服务。</h2><span>可填写多项 SDK 或合作方；名称、提供方和链接必须来自实际接入资料。</span></div>
    <div className="binary-choice"><button type="button" data-selected={answer === "NO"} onClick={() => props.onConfirm("NO")}>当前没有</button><button type="button" data-selected={answer === "YES"} onClick={() => props.onConfirm("YES")}>存在 SDK 或合作方</button></div>
    {data.partners.map((partner, index) => <article className="partner-form" key={`${index}-${partner.name}`}>
      <div className="partner-form-heading"><strong>第 {index + 1} 项</strong><button type="button" onClick={() => props.onRemove(index)}>删除</button></div>
      <div className="form-grid">
        <label><span>SDK/服务名称</span><input value={partner.name} onChange={(event) => props.onUpdate(index, { name: event.target.value })} /></label>
        <label><span>提供方</span><input value={partner.provider} onChange={(event) => props.onUpdate(index, { provider: event.target.value })} /></label>
        <label className="full-field choice-field"><span>使用目的（可多选）</span><div className="preset-chips">{props.purposePresets.map((purpose) => <button type="button" key={purpose} data-selected={partner.purposes.includes(purpose)} onClick={() => props.onTogglePurpose(index, purpose)}>{partner.purposes.includes(purpose) ? <Check weight="bold" /> : null}{purpose}</button>)}</div><textarea rows={2} value={partner.purposes.filter((item) => !props.purposePresets.includes(item)).join("、")} onChange={(event) => props.onUpdateOtherValues(index, "purposes", props.purposePresets, event.target.value)} placeholder="如有其他情况，请补充说明。" /></label>
        <label className="full-field choice-field"><span>涉及个人信息（可多选）</span><div className="preset-chips">{props.informationPresets.map((item) => <button type="button" key={item} data-selected={partner.informationItems.includes(item)} onClick={() => props.onToggleListValue(index, "informationItems", item)}>{partner.informationItems.includes(item) ? <Check weight="bold" /> : null}{item}</button>)}</div><textarea rows={2} value={partner.informationItems.filter((item) => !props.informationPresets.includes(item)).join("、")} onChange={(event) => props.onUpdateOtherValues(index, "informationItems", props.informationPresets, event.target.value)} placeholder="如有其他情况，请补充说明。" /></label>
        <label className="full-field choice-field"><span>调用的设备权限（可多选，没有可不选）</span><div className="preset-chips">{PARTNER_PERMISSION_PRESETS.map((item) => <button type="button" key={item} data-selected={partner.permissions.includes(item)} onClick={() => props.onToggleListValue(index, "permissions", item)}>{partner.permissions.includes(item) ? <Check weight="bold" /> : null}{item}</button>)}</div><textarea rows={2} value={partner.permissions.filter((item) => !PARTNER_PERMISSION_PRESETS.includes(item as (typeof PARTNER_PERMISSION_PRESETS)[number])).join("、")} onChange={(event) => props.onUpdateOtherValues(index, "permissions", PARTNER_PERMISSION_PRESETS, event.target.value)} placeholder="其他设备权限（可选）" /></label>
        <label><span>调用或发送时机</span><input value={partner.trigger} onChange={(event) => props.onUpdate(index, { trigger: event.target.value })} /></label>
        <label><span>隐私政策链接</span><input type="url" value={partner.privacyUrl} onChange={(event) => props.onUpdate(index, { privacyUrl: event.target.value })} /></label>
      </div>
    </article>)}
    {answer !== "NO" ? <button type="button" className="add-feature" onClick={props.onAdd}><Plus weight="bold" /> 添加 SDK 或合作方</button> : null}
    {data.partners.length > 0 ? <button type="button" className="button button-ghost partner-confirm" onClick={() => props.onConfirm("YES")}>确认当前清单</button> : null}
    <div className="supplement-question-list section-questions">{["third-party-initialization", "sharing-transfer-public"].map(props.renderSupplementQuestion)}</div>
    <div className="panel-actions"><button type="button" className="button button-ghost" onClick={props.onBack}><ArrowLeft weight="bold" /> 返回设备权限</button><button type="button" className="button button-primary" data-analytics-id="partners.next" disabled={!data.supplementAnswers["third-party-services"]} onClick={props.onNext}>进入存储与安全 <ArrowRight weight="bold" /></button></div>
  </section>;
}
