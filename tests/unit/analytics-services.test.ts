import { describe, expect, it, vi } from "vitest";
import { TenantAnalyticsRateLimiter, analyticsBatchLimit } from "@/src/analytics/rate-limit";
import {
  analyticsRetentionBatchSize,
  analyticsRetentionCutoff,
  analyticsRetentionDays,
  purgeExpiredAnalyticsEvents,
} from "@/src/analytics/retention";
import { normalizeFunnel } from "@/src/analytics/server";

describe("tenant analytics rate limiter", () => {
  it("limits the entire tenant instead of individual users", () => {
    const limiter = new TenantAnalyticsRateLimiter();
    expect(limiter.check("tenant-a", 1_000, 2).allowed).toBe(true);
    expect(limiter.check("tenant-a", 2_000, 2).allowed).toBe(true);
    expect(limiter.check("tenant-a", 3_000, 2)).toMatchObject({ allowed: false, retryAfterSeconds: 58 });
    expect(limiter.check("tenant-b", 3_000, 2).allowed).toBe(true);
    expect(limiter.check("tenant-a", 61_001, 2).allowed).toBe(true);
  });

  it("uses a safe default for invalid environment values", () => {
    expect(analyticsBatchLimit(undefined)).toBe(120);
    expect(analyticsBatchLimit("0")).toBe(120);
    expect(analyticsBatchLimit("240")).toBe(240);
  });
});

describe("analytics retention", () => {
  it("defaults to 180 days and accepts positive configuration", () => {
    expect(analyticsRetentionDays(undefined)).toBe(180);
    expect(analyticsRetentionDays("90")).toBe(90);
    expect(analyticsRetentionBatchSize(undefined)).toBe(1_000);
    expect(analyticsRetentionBatchSize("250")).toBe(250);
    expect(analyticsRetentionCutoff(new Date("2026-08-25T00:00:00.000Z"), 180).toISOString())
      .toBe("2026-02-26T00:00:00.000Z");
  });

  it("deletes expired events in bounded batches", async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ id: "evt_1" }, { id: "evt_2" }])
      .mockResolvedValueOnce([{ id: "evt_3" }]);
    const deleteMany = vi.fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = { analyticsEvent: { findMany, deleteMany } };

    const result = await purgeExpiredAnalyticsEvents(prisma as never, {
      now: new Date("2026-08-25T00:00:00.000Z"),
      retentionDays: 180,
      batchSize: 2,
      maxBatches: 10,
    });

    expect(result).toMatchObject({ deleted: 3, batches: 2, hasMore: false });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenNthCalledWith(1, { where: { id: { in: ["evt_1", "evt_2"] } } });
  });

  it("stops at the configured batch ceiling", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "evt_1" }]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const result = await purgeExpiredAnalyticsEvents({ analyticsEvent: { findMany, deleteMany } } as never, {
      now: new Date("2026-08-25T00:00:00.000Z"),
      batchSize: 1,
      maxBatches: 2,
    });
    expect(result).toMatchObject({ deleted: 2, batches: 2, hasMore: true });
  });
});

describe("project funnel normalization", () => {
  it("returns the agreed unique-project stages", () => {
    expect(normalizeFunnel({
      categorySelected: 10n,
      profileCompleted: 9n,
      processingCompleted: 8n,
      permissionsCompleted: 7n,
      partnersCompleted: 6n,
      storageCompleted: 5n,
      rightsCompleted: 4n,
      generationSucceeded: 4n,
      wordDownloaded: 3n,
    })).toEqual({
      unit: "unique_projects",
      stages: [
        { key: "category_selected", label: "选择类别", projects: 10 },
        { key: "profile_completed", label: "基本信息", projects: 9 },
        { key: "processing_completed", label: "功能与个人信息", projects: 8 },
        { key: "permissions_completed", label: "设备权限", projects: 7 },
        { key: "partners_completed", label: "SDK 与合作方", projects: 6 },
        { key: "storage_completed", label: "存储与安全", projects: 5 },
        { key: "rights_completed", label: "用户权利", projects: 4 },
        { key: "generation_succeeded", label: "生成成功", projects: 4 },
        { key: "word_downloaded", label: "下载 Word", projects: 3 },
      ],
    });
  });
});
