"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { SECURITY_PRESETS, type ProjectData } from "../workspace-model";

type Props = {
  data: ProjectData;
  complete: boolean;
  renderSupplementQuestion: (questionId: string) => ReactNode;
  onToggleValue: <K extends "locations" | "retentionPolicies" | "expiryActions">(key: K, value: NonNullable<ProjectData["storageAndSecurity"][K]>[number]) => void;
  onUpdateText: (field: "fixedPeriod" | "crossBorderDetail" | "expiryOther", value: string) => void;
  onToggleSecurityMeasure: (value: string) => void;
  onUpdateSecurityOther: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function StorageSecurityStep(props: Props) {
  const storage = props.data.storageAndSecurity;
  return <section className="workspace-panel panel-enter">
    <div className="panel-heading"><p>存储与安全</p><h2>统一确认保存规则，不再逐功能重复填写。</h2><span>请选择真实采用的存储位置、期限原则、到期处理和安全措施。</span></div>
    <div className="storage-section"><strong>存储位置</strong><div className="preset-chips">{([['CN','中华人民共和国境内'],['DEVICE','设备本地'],['CLOUD','云端服务器'],['OVERSEAS','向境外提供']] as const).map(([value,label]) => <button type="button" key={value} data-selected={storage.locations?.includes(value)} onClick={() => props.onToggleValue("locations", value)}>{storage.locations?.includes(value) ? <Check weight="bold" /> : null}{label}</button>)}</div>{storage.locations?.includes("OVERSEAS") ? <textarea value={storage.crossBorderDetail ?? ""} onChange={(event) => props.onUpdateText("crossBorderDetail", event.target.value)} placeholder="请说明境外接收方、所在国家或地区、涉及信息和处理目的" /> : null}</div>
    <div className="storage-section"><strong>保存期限原则</strong><div className="preset-chips">{([['MINIMUM_NECESSARY','提供服务所必需的最短期限'],['FIXED_PERIOD','固定期限'],['UNTIL_DELETION_OR_CLOSURE','用户删除或注销前'],['LEGAL_REQUIREMENT','法律法规另有要求']] as const).map(([value,label]) => <button type="button" key={value} data-selected={storage.retentionPolicies?.includes(value)} onClick={() => props.onToggleValue("retentionPolicies", value)}>{storage.retentionPolicies?.includes(value) ? <Check weight="bold" /> : null}{label}</button>)}</div>{storage.retentionPolicies?.includes("FIXED_PERIOD") ? <input value={storage.fixedPeriod ?? ""} onChange={(event) => props.onUpdateText("fixedPeriod", event.target.value)} placeholder="例如：服务日志保存 30 日" /> : null}</div>
    <div className="storage-section"><strong>期限届满后的处理</strong><div className="preset-chips">{([['DELETE','删除'],['ANONYMIZE','匿名化'],['OTHER','其他']] as const).map(([value,label]) => <button type="button" key={value} data-selected={storage.expiryActions?.includes(value)} onClick={() => props.onToggleValue("expiryActions", value)}>{storage.expiryActions?.includes(value) ? <Check weight="bold" /> : null}{label}</button>)}</div>{storage.expiryActions?.includes("OTHER") ? <input value={storage.expiryOther ?? ""} onChange={(event) => props.onUpdateText("expiryOther", event.target.value)} placeholder="填写其他处理方式" /> : null}</div>
    <div className="storage-section"><strong>实际采取的安全措施</strong><div className="preset-chips">{SECURITY_PRESETS.map((measure) => <button type="button" key={measure} data-selected={storage.securityMeasures?.includes(measure)} onClick={() => props.onToggleSecurityMeasure(measure)}>{storage.securityMeasures?.includes(measure) ? <Check weight="bold" /> : null}{measure}</button>)}</div><textarea value={(props.data.profile.securityMeasures ?? "").split(/[、；\n]/).map((item) => item.trim()).filter((item) => item && !SECURITY_PRESETS.includes(item as (typeof SECURITY_PRESETS)[number])).join("、")} onChange={(event) => props.onUpdateSecurityOther(event.target.value)} placeholder="其他实际安全措施（预设无法覆盖时填写）；不要填写尚未取得的认证" /></div>
    <div className="supplement-question-list section-questions">{["diagnostic-logs", "shutdown-data-handling"].map(props.renderSupplementQuestion)}</div>
    <div className="panel-actions"><button type="button" className="button button-ghost" onClick={props.onBack}><ArrowLeft weight="bold" /> 返回合作方</button><button type="button" className="button button-primary" data-analytics-id="storage.next" disabled={!props.complete} onClick={props.onNext}>确认并进入用户权利 <ArrowRight weight="bold" /></button></div>
  </section>;
}
