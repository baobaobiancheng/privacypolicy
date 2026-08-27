"use client";

import { ArrowClockwise, ArrowLeft, ArrowRight, Check, CheckCircle, FileDoc, ShieldCheck, SpinnerGap, Warning } from "@phosphor-icons/react";
import { MarkdownPreview } from "@/components/markdown-preview";
import { GenerationHistory } from "../generation-history";
import type { PreflightIssue } from "@/src/ai/deepseek";
import type { DisplayPreflightIssue, GenerationStageItem, LiveGenerationState, ProjectData, SnapshotItem } from "../workspace-model";

type Props = {
  data: ProjectData;
  selectedCount: number;
  processedFieldCount: number;
  completedSupplementCount: number;
  supplementCount: number;
  blockingDiagnostic: string;
  preflightIssues: DisplayPreflightIssue[];
  acknowledgedIssues: string[];
  generationStages: GenerationStageItem[];
  activeGenerationStage?: GenerationStageItem;
  liveGeneration: LiveGenerationState | null;
  generationElapsed: number;
  generationChapterProgress: number;
  history: SnapshotItem[];
  canGenerate: boolean;
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

function preflightIssueLabel(issue: DisplayPreflightIssue) {
  if (issue.severity === "WARNING") return "优化建议";
  if (issue.category === "THIRD_PARTY") return "第三方信息";
  if (issue.category === "CONTRADICTION") return "内容矛盾";
  if (issue.category === "IMPLAUSIBLE") return "信息异常";
  return "信息待补充";
}

function generationStageCopy(stage?: GenerationStageItem) {
  if (!stage) return {
    title: "生成任务正在排队。",
    description: "任务开始后会依次检查填写内容、查询相关法规并编写政策正文。",
    previewLabel: "等待生成",
  };
  return {
    FACT_CHECK: {
      title: "正在检查填写内容。",
      description: "正在核对产品事实及已确认事项；发现新的问题时会请您补充确认。",
      previewLabel: "事实检查中",
    },
    LAW_SEARCH: {
      title: "正在查询相关法规。",
      description: "正在根据产品功能和个人信息处理场景查询相关法规资料。",
      previewLabel: "法规查询中",
    },
    DRAFTING: {
      title: "正在编写隐私政策正文。",
      description: "正在结合已确认的产品事实和法规资料组织八章政策正文。",
      previewLabel: "正文生成中",
    },
    FINALIZING: {
      title: "正在核对正文并制作 Word。",
      description: "正在检查政策结构、事实一致性和文档格式。",
      previewLabel: "文档制作中",
    },
  }[stage.key];
}

export function GenerationStep(props: Props) {
  const { data } = props;
  const generating = data.generated?.status === "GENERATING";
  const stageCopy = generationStageCopy(props.activeGenerationStage);
  const draftingStarted = props.activeGenerationStage?.key === "DRAFTING" || props.activeGenerationStage?.key === "FINALIZING";
  const confirmedIssueCount = props.preflightIssues.filter((issue) => props.acknowledgedIssues.includes(issue.fingerprint)).length;
  const preflightReviewRound = props.preflightIssues[0]?.preflightRound ?? 1;
  const issueProgress = props.preflightIssues.length ? Math.round(confirmedIssueCount / props.preflightIssues.length * 100) : 0;
  return <section className="workspace-panel draft-panel panel-enter">
    {props.blockingDiagnostic ? <div className="warning-callout"><Warning weight="fill" /><div><strong>生成前还需补充</strong><span>{props.blockingDiagnostic}</span></div></div> : null}
    <div className="panel-heading">
      <p>隐私政策生成</p>
      <h2>{data.generated?.status === "SUCCEEDED" ? "隐私政策已生成，可预览或下载。" : generating ? stageCopy.title : data.generated?.status === "FAILED" ? "本次生成未完成，填写内容已保存。" : "确认以上事实后生成完整政策。"}</h2>
      <span>{data.generated?.status === "FAILED" ? "可查看原因后重新生成。" : generating ? stageCopy.description : "生成前会检查事实矛盾、按关键词查询法规，再组织八章正文。"}</span>
    </div>
    {props.preflightIssues.length > 0 ? <section className="preflight-review" aria-live="polite">
      <header className="preflight-review-heading">
        <span className="preflight-review-icon"><ShieldCheck weight="duotone" /></span>
        <div className="preflight-review-copy"><strong>第 {preflightReviewRound}/3 轮 · 核对 {props.preflightIssues.length} 项产品事实</strong><span>{preflightReviewRound === 3 ? "这是最后一轮；全部确认后将直接查询法规，不再重复核对。" : "系统不会替您修改答案；全部确认后将自动进入下一轮核对。"}</span></div>
        <div className="preflight-review-progress">
          <div><strong>{confirmedIssueCount} / {props.preflightIssues.length}</strong><span>已确认</span></div>
          <span className="preflight-review-progress-line" role="progressbar" aria-label="事实核对进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={issueProgress}><i style={{ width: `${issueProgress}%` }} /></span>
        </div>
      </header>
      <div className="preflight-issue-list">{props.preflightIssues.map((issue) => {
        const acknowledged = props.acknowledgedIssues.includes(issue.fingerprint);
        return <article key={issue.fingerprint} data-acknowledged={acknowledged} data-severity={issue.severity.toLowerCase()}>
          <div className="preflight-issue-content">
            <div className="preflight-issue-meta"><span>{preflightIssueLabel(issue)}</span>{acknowledged ? <em><CheckCircle weight="fill" /> 已确认当前填写</em> : <em>待核对</em>}</div>
            <h3>{issue.title}</h3>
            <p>{issue.description}</p>
            <div className="preflight-issue-question"><span>需要你确认</span><p>{issue.questionForUser}</p></div>
          </div>
          <div className="preflight-issue-actions">
            <button type="button" className="preflight-edit" onClick={() => props.onEditIssue(issue)}>返回对应表单 <ArrowRight weight="bold" /></button>
            <button type="button" className="preflight-keep" disabled={acknowledged} onClick={() => props.onAcknowledgeIssue(issue)}>{acknowledged ? <><CheckCircle weight="fill" /> 已确认当前填写</> : "信息无误，保留当前填写"}</button>
          </div>
        </article>;
      })}</div>
    </section> : null}
    {data.generated?.status !== "SUCCEEDED" ? <section className="generation-live" data-running={generating} aria-live="polite">
      <div className="generation-live-heading">
        <div><strong>{generating ? props.activeGenerationStage?.label ?? "正在生成" : "生成时将实时展示进度"}</strong><span>{generating ? props.activeGenerationStage?.message : "每一阶段都由服务端实际状态驱动"}</span></div>
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
    </section> : null}
    <div className="draft-preview">
      <div className="draft-page" data-streaming={generating && draftingStarted}>
        <span className="draft-watermark">{generating ? stageCopy.previewLabel : "隐私政策"}</span>
        <MarkdownPreview markdown={data.generatedMarkdown} fallback={<><h3>{data.profile.productName} 隐私政策</h3><p>{generating ? draftingStarted ? "智能体正在组织正文，首段内容生成后会实时显示在这里。" : `${stageCopy.title}完成准备后将自动开始编写正文。` : "完成信息填写后，系统会在这里展示可预览和下载的隐私政策。"}</p><h4>生成范围</h4><p>已选择 {props.selectedCount} 项产品功能和 {props.processedFieldCount} 项实际处理的个人信息。</p></>} />
        {generating && draftingStarted && data.generatedMarkdown ? <span className="draft-streaming-caret" aria-hidden="true" /> : null}
        <p className="draft-footnote">{generating ? draftingStarted ? "正文会持续更新，完成校验后即可下载 Word" : "完成事实检查和法规查询后开始生成正文" : `${props.processedFieldCount} 项实际处理信息 · ${props.supplementCount} 项补充信息`}</p>
      </div>
    </div>
    {props.history.length > 0 && <div className="draft-history"><div className="field-confirm-heading"><strong>生成记录</strong></div><GenerationHistory history={props.history} onDownload={props.onDownload} /></div>}
    <div className="panel-actions"><button type="button" className="button button-ghost" disabled={generating} onClick={props.onBack}><ArrowLeft weight="bold" /> 返回用户权利</button><button type="button" className="button button-primary" data-analytics-id={data.generated?.status === "SUCCEEDED" || data.generated?.status === "FAILED" ? "generation.retry" : "generation.start"} disabled={generating || !props.canGenerate} onClick={props.onGenerate}>{data.generated?.status === "SUCCEEDED" ? <><ArrowClockwise weight="bold" /> 重新生成</> : <><FileDoc weight="bold" /> {generating ? `正在生成 · ${formatGenerationTime(props.generationElapsed)}` : data.generated?.status === "FAILED" ? "重新生成" : "生成隐私政策"}</>}</button></div>
  </section>;
}
