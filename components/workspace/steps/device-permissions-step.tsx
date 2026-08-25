"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Plus } from "@phosphor-icons/react";
import { PERMISSION_PRESETS, type ProjectData } from "../workspace-model";

type PermissionPreset = (typeof PERMISSION_PRESETS)[number];
type Props = {
  data: ProjectData;
  complete: boolean;
  renderSupplementQuestion: (questionId: string) => ReactNode;
  onTogglePermission: (preset: PermissionPreset) => void;
  onAddCustomPermission: () => void;
  onUpdateCustomPermission: (key: string, patch: { label?: string; sceneOther?: string }) => void;
  onRemovePermission: (key: string) => void;
  onToggleScene: (key: string, scene: string) => void;
  onUpdateScene: (key: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function DevicePermissionsStep(props: Props) {
  const { data } = props;
  return <section className="workspace-panel panel-enter">
    <div className="panel-heading"><p>设备权限</p><h2>产品实际会调用哪些设备权限？</h2><span>权限会在对应功能触发时申请；没有使用的权限不会写入政策。</span></div>
    <div className="permission-selector-heading"><strong>选择产品实际使用的权限</strong><span>已选择 {data.permissions.length} 项</span></div>
    <div className="permission-selector-grid">{PERMISSION_PRESETS.map((preset) => { const selected = data.permissions.some((item) => item.key === preset.key); return <button type="button" key={preset.key} data-selected={selected} onClick={() => props.onTogglePermission(preset)}><span className="feature-check">{selected ? <Check weight="bold" /> : null}</span><span><strong>{preset.label}</strong><small>{preset.description}</small></span></button>; })}</div>
    <button type="button" className="add-feature permission-add-custom" onClick={props.onAddCustomPermission}><Plus weight="bold" /> 添加其他设备权限</button>
    {data.permissions.length ? <div className="selected-permission-list"><div className="selected-permission-heading"><strong>补充已选权限的使用场景</strong></div>{data.permissions.map((selected) => { const preset = PERMISSION_PRESETS.find((item) => item.key === selected.key); return <article key={selected.key}><div className="selected-permission-title"><div><strong>{preset?.label || selected.label || "其他设备权限"}</strong>{preset ? <span>{preset.description}</span> : null}</div><button type="button" onClick={() => preset ? props.onTogglePermission(preset) : props.onRemovePermission(selected.key)}>移除</button></div>{preset ? <div className="preset-chips">{preset.scenes.map((scene) => <button type="button" key={scene} data-selected={selected.scenes.includes(scene)} onClick={() => props.onToggleScene(preset.key, scene)}>{selected.scenes.includes(scene) ? <Check weight="bold" /> : null}{scene}</button>)}</div> : <label><span>权限名称</span><input value={selected.label} onChange={(event) => props.onUpdateCustomPermission(selected.key, { label: event.target.value })} placeholder="例如：蓝牙权限" /></label>}<label><span>{preset ? "其他使用场景（可选）" : "使用场景"}</span><textarea rows={2} value={selected.sceneOther} onChange={(event) => preset ? props.onUpdateScene(preset.key, event.target.value) : props.onUpdateCustomPermission(selected.key, { sceneOther: event.target.value })} placeholder="如有其他情况，请补充说明。" /></label></article>; })}</div> : null}
    <div className="supplement-question-list section-questions">{["background-location", "notification-push", "cookies-local-storage", "sensitive-information"].map(props.renderSupplementQuestion)}</div>
    <div className="panel-actions"><button type="button" className="button button-ghost" onClick={props.onBack}><ArrowLeft weight="bold" /> 返回功能信息</button><button type="button" className="button button-primary" disabled={!props.complete} onClick={props.onNext}>进入 SDK 与合作方 <ArrowRight weight="bold" /></button></div>
  </section>;
}
