"use client";

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { ProjectSaveCoordinator, type ProjectSaveRequest, type ProjectSaveResult } from "@/src/workspace/project-save-coordinator";
import type { ProjectFormData } from "@/src/workspace/contract";
import { CLIENT_PERSONA_ID, type ProjectData } from "./workspace-model";
import { toProjectFormData } from "./workspace-project-mapper";

type SaveState = "idle" | "saving" | "saved" | "error";

type ProjectPersistenceOptions = {
  dataRef: MutableRefObject<ProjectData>;
  changeVersionRef: MutableRefObject<number>;
  setData: Dispatch<SetStateAction<ProjectData>>;
  setStatusMessage: Dispatch<SetStateAction<string>>;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
};

export function useProjectPersistence(options: ProjectPersistenceOptions) {
  const coordinatorRef = useRef<ProjectSaveCoordinator<ProjectFormData> | null>(null);

  function request(stepKey: string): ProjectSaveRequest<ProjectFormData> {
    return {
      buildSnapshot: () => toProjectFormData(options.dataRef.current),
      stepKey,
      version: options.changeVersionRef.current,
    };
  }

  function coordinator() {
    if (coordinatorRef.current) return coordinatorRef.current;
    coordinatorRef.current = new ProjectSaveCoordinator<ProjectFormData>({
      revision: options.dataRef.current.revision,
      transport: async (snapshot, currentStepKey, expectedRevision, signal) => {
        const id = options.dataRef.current.projectId;
        if (!id) return { kind: "error", message: "项目尚未创建。" };
        const response = await fetch(`/api/v1/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-persona-id": CLIENT_PERSONA_ID },
          body: JSON.stringify({ expectedRevision, formData: snapshot, currentStepKey }),
          signal,
        });
        if (response.status === 409) {
          const payload = await response.json().catch(() => null) as { error?: { details?: { currentRevision?: number | null } } } | null;
          return { kind: "conflict", currentRevision: payload?.error?.details?.currentRevision ?? null };
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          return { kind: "error", message: payload?.error?.message || "保存失败。" };
        }
        const payload = await response.json() as { data: { revision: number } };
        return { kind: "saved", revision: payload.data.revision };
      },
      onStateChange: (state) => options.setSaveState(state === "conflict" ? "error" : state),
      onSaved: (revision) => {
        const merged = { ...options.dataRef.current, revision };
        options.dataRef.current = merged;
        options.setData(merged);
      },
      onConflict: (currentRevision) => {
        options.setStatusMessage(`项目已在其他页面更新${currentRevision === null ? "" : `（服务器修订号 ${currentRevision}）`}。当前输入已保留，请刷新页面后重新确认。`);
      },
    });
    return coordinatorRef.current;
  }

  async function persistNow(stepKey: string): Promise<{ ok: true; revision: number } | { ok: false }> {
    if (!options.dataRef.current.projectId) return { ok: false };
    const result: ProjectSaveResult = await coordinator().flush(request(stepKey));
    if (result.kind === "saved") return { ok: true, revision: result.revision };
    if (result.kind === "error") options.setStatusMessage(result.message || "保存到服务器失败。");
    return { ok: false };
  }

  useEffect(() => () => {
    const current = coordinatorRef.current;
    current?.cancel();
    if (coordinatorRef.current === current) coordinatorRef.current = null;
  }, []);

  return {
    persistNow,
    schedule: (stepKey: string) => coordinator().schedule(request(stepKey)),
    setRevision: (revision: number) => coordinator().setRevision(revision),
  };
}
