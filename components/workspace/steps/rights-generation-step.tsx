"use client";

import type { ReactNode } from "react";
import { ArrowClockwise, ArrowLeft, ArrowRight, Check, FileDoc, SpinnerGap, Warning, WarningCircle } from "@phosphor-icons/react";
import { MarkdownPreview } from "@/components/markdown-preview";
import { GenerationHistory } from "../generation-history";
import { RIGHTS_FIELD_PRESETS, rightsProfileFields, type DisplayPreflightIssue, type GenerationStageItem, type LiveGenerationState, type ProjectData, type SnapshotItem } from "../workspace-model";
import type { PreflightIssue } from "@/src/ai/deepseek";

type Props = {
  data: ProjectData;
  renderSupplementQuestion: (questionId: string) => ReactNode;
  selectedCount: number;
  processedFieldCount: number;
  completedSupplementCount: number;
  supplementCount: number;
  blockingDiagnostic: string;
  warningCount: number;
  preflightIssues: DisplayPreflightIssue[];
  acknowledgedIssues: string[];
  generationStages: GenerationStageItem[];
  activeGenerationStage?: GenerationStageItem;
  liveGeneration: LiveGenerationState | null;
  generationElapsed: number;
  generationChapterProgress: number;
  history: SnapshotItem[];
  canGenerate: boolean;
  onUpdateProfile: (field: string, value: string) => void;
  onToggleProfilePreset: (field: string, value: string, multiple?: boolean) => void;
  onUpdateProfileOther: (field: string, presets: readonly string[], value: string, multiple?: boolean) => void;
  onUpdateNotes: (value: string) => void;
  onEditIssue: (issue: PreflightIssue) => void;
  onAcknowledgeIssue: (issue: DisplayPreflightIssue) => void;
  onDownload: (item: SnapshotItem) => void;
  onBack: () => void;
  onGenerate: () => void;
};

function formatGenerationTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RightsGenerationStep(props: Props) {
  const { data } = props;
  const generating = data.generated?.status === "GENERATING";
  return <section className="workspace-panel draft-panel panel-enter">
    <div className="panel-heading"><p>用户权利与生成</p><h2>最后确认权利入口和联系方式。</h2><span>这些内容会进入“管理您的个人信息”“政策修订”和“联系我们”等章节。</span></div>
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
    <div className="review-summary-grid final-summary"><div><span>产品功能</span><strong>{props.selectedCount}</strong></div><div><span>个人信息</span><strong>{props.processedFieldCount}</strong></div><div><span>已完成补充</span><strong>{props.completedSupplementCount}/{props.supplementCount}</strong></div></div>
    {props.blockingDiagnostic ? <div className="warning-callout"><Warning weight="fill" /><div><strong>生成前还需补充</strong><span>{props.blockingDiagnostic}</span></div></div> : null}
    <div className="generation-divider" />
    <div className="panel-heading">
      <p>生成隐私政策</p>
      <h2>{data.generated?.status === "SUCCEEDED" ? "隐私政策已生成，可预览或下载。" : generating ? "正在编写隐私政策正文。" : data.generated?.status === "FAILED" ? "本次生成未完成，填写内容已保存。" : "确认以上事实后生成完整政策。"}</h2>
      <span>{data.generated?.status === "FAILED" ? "可查看原因后重新生成。" : "生成前会检查事实矛盾、按关键词查询法规，再组织八章正文。"}</span>
    </div>
    {props.preflightIssues.length > 0 ? <section className="preflight-review" aria-live="polite">
      <div className="preflight-review-heading"><WarningCircle weight="fill" /><div><strong>生成前请先核对 {props.preflightIssues.length} 项产品事实</strong><span>系统没有替您修改答案。请回到对应表单补充或修正后，再重新生成。</span></div></div>
      <div className="preflight-issue-list">{props.preflightIssues.map((issue) => <article key={issue.fingerprint} data-acknowledged={props.acknowledgedIssues.includes(issue.fingerprint)}>
        <div><span>{issue.severity === "WARNING" ? "优化建议" : issue.category === "THIRD_PARTY" ? "第三方信息" : issue.category === "CONTRADICTION" ? "内容矛盾" : issue.category === "IMPLAUSIBLE" ? "信息异常" : "信息待补充"}</span><strong>{issue.title}</strong><p>{issue.description}</p><small>{issue.questionForUser}</small></div>
        <div className="preflight-issue-actions"><button type="button" onClick={() => props.onEditIssue(issue)}>返回修改 <ArrowRight weight="bold" /></button>{issue.severity === "BLOCKING" ? <button type="button" className="preflight-keep" disabled={props.acknowledgedIssues.includes(issue.fingerprint)} onClick={() => props.onAcknowledgeIssue(issue)}>{props.acknowledgedIssues.includes(issue.fingerprint) ? "已保留当前填写" : "信息无误，保留当前填写"}</button> : null}</div>
      </article>)}</div>
    </section> : null}
    <section className="generation-live" data-running={generating} aria-live="polite">
      <div className="generation-live-heading">
        <div><strong>{generating ? props.activeGenerationStage?.label ?? "正在生成" : data.generated?.status === "SUCCEEDED" ? "本次生成已完成" : "生成时将实时展示进度"}</strong><span>{generating ? props.activeGenerationStage?.message : "每一阶段都由服务端实际状态驱动"}</span></div>
        {generating ? <time>已等待 {formatGenerationTime(props.generationElapsed)}</time> : null}
      </div>
      <div className="generation-stage-track">{props.generationStages.map((stage, index) => <div key={stage.key} data-status={stage.status.toLowerCase()}>
        <span className="generation-stage-marker">{stage.status === "COMPLETED" ? <Check weight="bold" /> : stage.status === "ACTIVE" ? <SpinnerGap weight="bold" /> : index + 1}</span>
        <strong>{stage.label}</strong><small>{stage.message}{stage.durationMs !== undefined ? ` · ${formatGenerationTime(stage.durationMs)}` : ""}</small>
      </div>)}</div>
      {generating && props.liveGeneration ? <div className="generation-live-detail">
        <div><span>当前章节</span><strong>{props.liveGeneration.currentSection}</strong></div>
        <div><span>{props.liveGeneration.phase === "THINKING" ? "实时模型响应" : "已完成章节"}</span><strong>{props.liveGeneration.phase === "THINKING" ? `${props.liveGeneration.activityCount.toLocaleString("zh-CN")} 次更新` : `${props.liveGeneration.completedSections} / ${props.liveGeneration.totalSections}`}</strong></div>
        <div><span>已生成正文</span><strong>{props.liveGeneration.characterCount.toLocaleString("zh-CN")} 字</strong></div>
        <div className="generation-chapter-line" aria-label={`已完成 ${props.liveGeneration.completedSections} / ${props.liveGeneration.totalSections} 个章节`}><span style={{ width: `${props.generationChapterProgress}%` }} /></div>
      </div> : null}
    </section>
    <div className="draft-preview"><div className="draft-page" data-streaming={generating}><span className="draft-watermark">{generating ? "生成中预览" : "隐私政策"}</span><MarkdownPreview markdown={data.generatedMarkdown} fallback={<><h3>{data.profile.productName} 隐私政策</h3><p>{generating ? "智能体正在组织正文，首段内容生成后会实时显示在这里。" : "完成信息填写后，系统会在这里展示可预览和下载的隐私政策。"}</p><h4>生成范围</h4><p>已选择 {props.selectedCount} 项产品功能和 {props.processedFieldCount} 项实际处理的个人信息。</p></>} />{generating && data.generatedMarkdown ? <span className="draft-streaming-caret" aria-hidden="true" /> : null}<p className="draft-footnote">{generating ? "正文会持续更新，完成校验后即可下载 Word" : `${props.processedFieldCount} 项实际处理信息 · ${props.supplementCount} 项补充信息`}</p></div><aside className="draft-audit"><FileDoc weight="duotone" /><strong>{generating ? "正文实时预览" : "政策预览"}</strong><span>{props.selectedCount} 项产品功能</span><span>{props.processedFieldCount} 项实际处理信息</span><span>{props.supplementCount} 项补充信息</span><span>{generating ? "完成校验后开放 Word" : `${props.warningCount} 项重点核对提示`}</span></aside></div>
    {props.history.length > 0 && <div className="draft-history"><div className="field-confirm-heading"><strong>生成记录</strong><span>显示最新一份成功生成的隐私政策。</span></div><GenerationHistory history={props.history} onDownload={props.onDownload} /></div>}
    <div className="panel-actions"><button type="button" className="button button-ghost" disabled={generating} onClick={props.onBack}><ArrowLeft weight="bold" /> 返回存储与安全</button><button type="button" className="button button-primary" disabled={generating || !props.canGenerate} onClick={props.onGenerate}>{data.generated?.status === "SUCCEEDED" ? <><ArrowClockwise weight="bold" /> 重新生成</> : <><FileDoc weight="bold" /> {generating ? `正在生成 · ${formatGenerationTime(props.generationElapsed)}` : data.generated?.status === "FAILED" ? "重新生成" : "生成隐私政策"}</>}</button></div>
  </section>;
}
