"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { PreflightIssue } from "@/src/ai/deepseek";
import { preflightIssueFingerprint } from "@/src/domain/preflight-issue";
import {
  CLIENT_PERSONA_ID,
  INITIAL_GENERATION_STAGES,
  type DisplayPreflightIssue,
  type GenerationJobPayload,
  type LiveGenerationState,
  type ProjectData,
  type SnapshotItem,
} from "./workspace-model";

type GenerationRunnerOptions = {
  generatedStatus?: ProjectData["generated"];
  commit: (next: Partial<ProjectData>, message?: string) => void;
  setData: Dispatch<SetStateAction<ProjectData>>;
  setHistory: Dispatch<SetStateAction<SnapshotItem[] | null>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  setPreflightIssues: Dispatch<SetStateAction<DisplayPreflightIssue[]>>;
};

export function useGenerationRunner(options: GenerationRunnerOptions) {
  const [liveGeneration, setLiveGeneration] = useState<LiveGenerationState | null>(null);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const trackedGenerationRef = useRef<string | null>(null);

  useEffect(() => {
    if (options.generatedStatus?.status !== "GENERATING" || !liveGeneration) return;
    const updateElapsed = () => setGenerationElapsed(Date.now() - liveGeneration.startedAt);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [options.generatedStatus?.status, liveGeneration]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    trackedGenerationRef.current = null;
  }, []);

  async function run(projectId: string, idempotencyKey: string, acknowledgedPreflightIssues: readonly string[] = []) {
    const controller = beginTracking(null, Date.now());
    let generationId = idempotencyKey;
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
        body: JSON.stringify({ idempotencyKey, acknowledgedPreflightIssues }),
        signal: controller.signal,
      });
      const created = await response.json() as { data?: GenerationJobPayload; error?: { message?: string } };
      if (!response.ok || !created.data) throw new Error(created.error?.message || "生成任务创建失败");
      generationId = created.data.id;
      trackedGenerationRef.current = generationId;
      options.commit(
        { generated: { status: "GENERATING", generationId, createdAt: created.data.createdAt }, generatedMarkdown: "" },
        created.data.state === "QUEUED" ? "任务已加入生成队列" : "已恢复当前项目的生成任务",
      );
      await monitor(projectId, created.data, controller);
    } catch (error) {
      handleFailure(error, controller, generationId);
    } finally {
      finishTracking(controller);
    }
  }

  async function resume(projectId: string, job: GenerationJobPayload) {
    if (trackedGenerationRef.current === job.id && controllerRef.current) return;
    const controller = beginTracking(job.id, Date.parse(job.createdAt) || Date.now());
    options.commit({
      generated: {
        status: job.state === "SUCCEEDED" ? "SUCCEEDED" : job.state === "FAILED" || job.state === "SUPERSEDED" ? "FAILED" : "GENERATING",
        generationId: job.id,
        createdAt: job.createdAt,
        message: job.error?.message,
      },
      generatedMarkdown: job.previewMarkdown ?? "",
    }, job.state === "QUEUED" || job.state === "RUNNING" ? "已恢复当前项目的生成任务" : undefined);
    try {
      await monitor(projectId, job, controller);
    } catch (error) {
      handleFailure(error, controller, job.id);
    } finally {
      finishTracking(controller);
    }
  }

  function beginTracking(generationId: string | null, startedAt: number) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    trackedGenerationRef.current = generationId;
    options.setPreflightIssues([]);
    setLiveGeneration({
      startedAt,
      stages: INITIAL_GENERATION_STAGES.map((stage) => ({ ...stage, status: "WAITING" })),
      completedSections: 0,
      totalSections: 8,
      currentSection: generationId ? "正在恢复生成状态" : "任务已加入生成队列",
      characterCount: 0,
      phase: "THINKING",
      activityCount: 0,
    });
    setGenerationElapsed(Math.max(0, Date.now() - startedAt));
    return controller;
  }

  async function monitor(projectId: string, initialJob: GenerationJobPayload, controller: AbortController) {
    let job = initialJob;
    for (;;) {
      updateLiveState(job);
      if (job.previewMarkdown) options.setData((current) => ({ ...current, generatedMarkdown: job.previewMarkdown ?? "" }));

      if (job.state === "SUCCEEDED" && job.reportId) {
        const reportResponse = await fetch(`/api/v1/projects/${projectId}/reports/${job.reportId}`, {
          headers: { "x-persona-id": CLIENT_PERSONA_ID },
          signal: controller.signal,
        });
        const reportPayload = await reportResponse.json() as { data?: { id: string; createdAt: string; markdown: string; downloadUrl: string }; error?: { message?: string } };
        if (!reportResponse.ok || !reportPayload.data) throw new Error(reportPayload.error?.message || "生成结果加载失败");
        const item: SnapshotItem = { ...reportPayload.data, state: "SUCCEEDED" };
        options.setHistory([item]);
        options.setData((current) => ({ ...current, generated: { status: "SUCCEEDED", generationId: job.id, createdAt: item.createdAt }, generatedMarkdown: item.markdown }));
        options.setStatusMessage("隐私政策已生成，可在线预览或下载 Word");
        return;
      }
      if (job.state === "SUPERSEDED") throw new Error("生成期间项目内容已更新，请按当前版本重新生成。");
      if (job.state === "FAILED") {
        if (job.error?.code === "FORM_SEMANTIC_REVIEW_REQUIRED") {
          const details = job.error.details as { issues?: PreflightIssue[]; preflightRound?: number } | undefined;
          options.setPreflightIssues((details?.issues ?? []).map((issue) => ({
            ...issue,
            fingerprint: preflightIssueFingerprint(issue),
            preflightRound: details?.preflightRound,
          })));
        }
        throw new Error(job.error?.message || failureMessage(job.error?.code) || "本次生成未完成，请稍后重试");
      }

      await waitForPoll(controller.signal);
      const poll = await fetch(`/api/v1/projects/${projectId}/generations/${job.id}`, {
        headers: { "x-persona-id": CLIENT_PERSONA_ID },
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await poll.json() as { data?: GenerationJobPayload; error?: { message?: string } };
      if (!poll.ok || !payload.data) throw new Error(payload.error?.message || "生成状态加载失败");
      job = payload.data;
    }
  }

  function updateLiveState(job: GenerationJobPayload) {
    const currentStageIndex = INITIAL_GENERATION_STAGES.findIndex((stage) => stage.key === job.stage);
    setLiveGeneration((current) => current ? {
      ...current,
      stages: current.stages.map((stage, index) => ({
        ...stage,
        status: job.state === "FAILED" && index === currentStageIndex ? "FAILED"
          : index < currentStageIndex || job.stage === "COMPLETED" ? "COMPLETED"
            : index === currentStageIndex ? "ACTIVE" : "WAITING",
        message: index === currentStageIndex && job.progress?.message ? job.progress.message : stage.message,
      })),
      completedSections: job.progress?.completedSections ?? current.completedSections,
      totalSections: job.progress?.totalSections ?? current.totalSections,
      currentSection: job.progress?.currentSection ?? job.progress?.message ?? current.currentSection,
      characterCount: job.progress?.characterCount ?? current.characterCount,
      phase: job.progress?.phase ?? current.phase,
      activityCount: job.progress?.activityCount ?? current.activityCount,
    } : current);
  }

  function handleFailure(error: unknown, controller: AbortController, generationId: string) {
    if (controller.signal.aborted) return;
    const message = error instanceof Error ? error.message : "生成失败，可使用同一份表单重试";
    setLiveGeneration((current) => current ? {
      ...current,
      stages: current.stages.map((stage) => stage.status === "ACTIVE" ? { ...stage, status: "FAILED", message } : stage),
    } : current);
    options.setData((current) => ({ ...current, generated: { status: "FAILED", generationId, createdAt: current.generated?.createdAt ?? new Date().toISOString(), message } }));
    options.setStatusMessage(message);
  }

  function finishTracking(controller: AbortController) {
    if (controllerRef.current !== controller) return;
    controllerRef.current = null;
    trackedGenerationRef.current = null;
  }

  return { liveGeneration, generationElapsed, run, resume };
}

function waitForPoll(signal: AbortSignal): Promise<void> {
  const delay = document.visibilityState === "hidden" ? 5_000 : 1_500;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, delay);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(signal.reason ?? new DOMException("轮询已取消。", "AbortError"));
    }, { once: true });
  });
}

function failureMessage(code?: string): string | undefined {
  return {
    MODEL_OUTPUT_INVALID: "生成结果缺少必要章节，或包含表单中未确认的内容，因此没有保存为可下载文件。本次填写内容已保存，可直接重新生成。",
    MODEL_REQUEST_FAILED: "本次等待超时或服务暂时无法连接。填写内容已保存，请稍后直接重新生成。",
    DOCX_GENERATION_FAILED: "隐私政策转换为 Word 文件时发生异常。请重新生成；如果问题持续出现，请联系系统管理员。",
    LAW_SEARCH_FAILED: "生成前未能取得法规关键词查询结果，因此没有继续生成。填写内容已保存，可稍后重新生成。",
  }[code ?? ""];
}
