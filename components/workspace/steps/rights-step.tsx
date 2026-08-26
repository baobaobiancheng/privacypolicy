"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { RIGHTS_FIELD_PRESETS, rightsProfileFields, type ProjectData } from "../workspace-model";

type Props = {
  data: ProjectData;
  renderSupplementQuestion: (questionId: string) => ReactNode;
  complete: boolean;
  blockingDiagnostic: string;
  onUpdateProfile: (field: string, value: string) => void;
  onToggleProfilePreset: (field: string, value: string, multiple?: boolean) => void;
  onUpdateProfileOther: (field: string, presets: readonly string[], value: string, multiple?: boolean) => void;
  onUpdateNotes: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function RightsStep(props: Props) {
  const { data } = props;
  return <section className="workspace-panel panel-enter">
    <div className="panel-heading"><p>用户权利</p><h2>确认用户行使权利的入口和联系渠道。</h2><span>这些内容会进入“管理您的个人信息”“政策修订”和“联系我们”等章节。</span></div>
    <div className="form-grid rights-form">{rightsProfileFields.map(([key, label, placeholder]) => {
      const options = RIGHTS_FIELD_PRESETS[key];
      const value = data.profile[key] ?? "";
      const isPreset = Boolean(options?.includes(value));
      const showChoices = Boolean(options);
      return <label key={key} className={showChoices || key === "minorProcessing" ? "full-field choice-field" : ""}>
        <span>{label}</span>
        {options ? <div className="preset-chips">{options.map((option) => <button type="button" key={option} data-selected={value === option} onClick={() => props.onToggleProfilePreset(key, option)}>{value === option ? <Check weight="bold" /> : null}{option}</button>)}</div> : null}
        {key === "minorProcessing" || options
          ? <textarea value={isPreset ? "" : value} onChange={(event) => props.onUpdateProfileOther(key, options ?? [], event.target.value)} placeholder={`其他${label}（预设无法覆盖时填写）`} />
          : <input type={key === "contactEmail" ? "email" : "text"} value={value} onChange={(event) => props.onUpdateProfile(key, event.target.value)} placeholder={placeholder} />}
      </label>;
    })}</div>
    <div className="supplement-question-list section-questions final-questions">{["account-cloud-sync", "history-and-favorites", "personalized-content", "customer-service-records", "user-control-paths", "custom-feature-data"].map(props.renderSupplementQuestion)}</div>
    <label className="additional-notes"><span>报告外的其他补充（可选）</span><small>只填写产品实际存在且前面没有覆盖的情况。</small><textarea value={data.additionalNotes} onChange={(event) => props.onUpdateNotes(event.target.value)} /></label>
    {props.blockingDiagnostic ? <div className="warning-callout"><div><strong>进入生成前还需补充</strong><span>{props.blockingDiagnostic}</span></div></div> : null}
    <div className="panel-actions"><button type="button" className="button button-ghost" onClick={props.onBack}><ArrowLeft weight="bold" /> 返回存储与安全</button><button type="button" className="button button-primary" data-analytics-id="rights.next" disabled={!props.complete} onClick={props.onNext}>确认并进入隐私政策生成 <ArrowRight weight="bold" /></button></div>
  </section>;
}
