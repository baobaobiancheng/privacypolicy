import { DomainError } from "@/src/domain/errors";

export type ExportState = "PENDING" | "GENERATING" | "SUCCEEDED" | "FAILED";
export type ExportFailure = { code: string; retryable: boolean };

const allowed: Record<ExportState, ReadonlySet<ExportState>> = {
  PENDING: new Set(["PENDING", "GENERATING", "FAILED"]),
  GENERATING: new Set(["GENERATING", "SUCCEEDED", "FAILED"]),
  SUCCEEDED: new Set(["SUCCEEDED"]),
  FAILED: new Set(["FAILED", "PENDING", "GENERATING"]),
};

export function transitionExportState(from: ExportState, to: ExportState): ExportState {
  if (!allowed[from].has(to)) {
    throw new DomainError("DOCX_GENERATION_FAILED", "导出状态不能执行该转换。", { retryable: false, details: { from, to } });
  }
  return to;
}

export function recoverExpiredGeneration(state: ExportState, leaseExpiresAt: Date | null, now = new Date()): { state: ExportState; failure: ExportFailure | null } {
  if (state !== "GENERATING" || !leaseExpiresAt || leaseExpiresAt.getTime() > now.getTime()) {
    return { state, failure: null };
  }
  return { state: "FAILED", failure: { code: "EXPORT_LEASE_EXPIRED", retryable: true } };
}
