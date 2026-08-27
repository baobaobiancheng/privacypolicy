"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { PLATFORM_PRESETS, basicProfileFields, type ProjectData } from "../workspace-model";
import { getAppQuestionnaire } from "@/src/questionnaires";

type Props = {
  data: ProjectData;
  complete: boolean;
  onUpdate: (field: string, value: string) => void;
  onTogglePreset: (field: string, value: string, multiple?: boolean) => void;
  onUpdateOther: (field: string, presets: readonly string[], value: string, multiple?: boolean) => void;
  onNext: () => void;
};

export function BasicInformationStep({ data, complete, onUpdate, onTogglePreset, onUpdateOther, onNext }: Props) {
  const questionnaire = getAppQuestionnaire(data.categoryKey);
  return <section className="workspace-panel panel-enter">
    <div className="panel-heading"><p>基本信息 · {data.categoryLabel}类</p><h2>先确认这份政策对应的产品。</h2><span>适用于以{questionnaire.basicFunction}为主要基本功能的产品。</span></div>
    <div className="form-grid">{basicProfileFields.map(([key, label, placeholder]) => key === "platform" ? <div key={key} className="full-field choice-field form-field-group"><span>{label}</span><div className="preset-chips">{PLATFORM_PRESETS.map((platform) => { const selected = (data.profile.platform ?? "").split("、").includes(platform); return <button type="button" key={platform} data-selected={selected} onClick={() => onTogglePreset("platform", platform, true)}>{selected ? <Check weight="bold" /> : null}{platform}</button>; })}</div><input aria-label="其他平台" value={(data.profile.platform ?? "").split("、").filter((item) => !PLATFORM_PRESETS.includes(item as (typeof PLATFORM_PRESETS)[number])).join("、")} onChange={(event) => onUpdateOther("platform", PLATFORM_PRESETS, event.target.value, true)} placeholder="其他平台（可选）" /></div> : <label key={key}><span>{label}</span><input type={key.includes("Date") ? "date" : "text"} value={data.profile[key] ?? ""} onChange={(event) => onUpdate(key, event.target.value)} placeholder={key === "productName" ? `例如：${data.categoryLabel}产品` : key === "operatorName" ? `例如：某${data.categoryLabel}科技有限公司` : placeholder} /></label>)}</div>
    <div className="panel-actions"><Link className="button button-ghost" href="/projects/new/category"><ArrowLeft weight="bold" /> 更换类别</Link><button type="button" className="button button-primary" data-analytics-id="profile.next" disabled={!complete} onClick={onNext}>保存并选择功能 <ArrowRight weight="bold" /></button></div>
  </section>;
}
