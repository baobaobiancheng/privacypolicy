import { describe, expect, it } from "vitest";
import { recoverExpiredGeneration, transitionExportState } from "@/src/domain/draft/export-state";

describe("快照导出状态机", () => {
  it("只允许 PENDING 到 GENERATING，再到成功或失败", () => {
    expect(transitionExportState("PENDING", "GENERATING")).toBe("GENERATING");
    expect(transitionExportState("GENERATING", "SUCCEEDED")).toBe("SUCCEEDED");
    expect(() => transitionExportState("SUCCEEDED", "PENDING")).toThrowError(/导出状态/);
  });

  it("租约过期的生成任务可恢复重试", () => {
    const result = recoverExpiredGeneration("GENERATING", new Date("2026-08-10T00:00:00Z"), new Date("2026-08-10T01:00:00Z"));
    expect(result).toEqual({ state: "FAILED", failure: { code: "EXPORT_LEASE_EXPIRED", retryable: true } });
  });
});
