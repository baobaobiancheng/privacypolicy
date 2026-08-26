import { describe, expect, it } from "vitest";
import { AnalyticsRangeSchema, ClientAnalyticsBatchSchema, createAnalyticsRangeSchema, explicitAnalyticsAction, normalizeAnalyticsPagePath } from "@/src/analytics/contract";

const common = {
  sessionId: "ses_0198f2d3-1234-7abc-8def-1234567890ab",
  pagePath: "/projects/new/category",
  occurredAt: "2026-08-25T08:00:00.000Z",
};

describe("analytics event contract", () => {
  it("only accepts explicitly assigned click actions", () => {
    expect(explicitAnalyticsAction(undefined)).toBeNull();
    expect(explicitAnalyticsAction("  ")).toBeNull();
    expect(explicitAnalyticsAction("profile.next")).toBe("profile.next");
    expect(explicitAnalyticsAction("报告 下载")).toBeNull();
  });

  it("groups project pages without exposing each project id as a separate route", () => {
    expect(normalizeAnalyticsPagePath("/projects/prj_01a037db-c683-7906-9c5f-1748a6e1f77d/profile"))
      .toBe("/projects/:projectId/profile");
    expect(normalizeAnalyticsPagePath("/projects/prj_01a037db-c683-7906-9c5f-1748a6e1f77d/activities/navigation"))
      .toBe("/projects/:projectId/activities/:activityId");
    expect(normalizeAnalyticsPagePath("/projects/new/category")).toBe("/projects/new/category");
  });

  it("accepts privacy-safe page and click metadata", () => {
    expect(ClientAnalyticsBatchSchema.parse({ events: [
      { ...common, eventName: "PAGE_VIEW", properties: { referrerHost: "example.test" } },
      { ...common, eventName: "BUTTON_CLICK", properties: { action: "profile.next", target: "button" } },
      { ...common, eventName: "PAGE_DURATION", durationMs: 12_500, properties: {} },
    ] }).events).toHaveLength(3);
  });

  it("rejects prompt text and server-owned event names from the browser", () => {
    expect(ClientAnalyticsBatchSchema.safeParse({ events: [
      { ...common, eventName: "BUTTON_CLICK", properties: { action: "用户填写的真实问题", target: "button" } },
    ] }).success).toBe(false);
    expect(ClientAnalyticsBatchSchema.safeParse({ events: [
      { ...common, eventName: "WORD_DOWNLOADED", properties: {} },
    ] }).success).toBe(false);
  });

  it("limits summary queries to the 180-day raw-event retention window", () => {
    expect(AnalyticsRangeSchema.safeParse({ from: "2026-08-01", to: "2026-08-25" }).success).toBe(true);
    expect(AnalyticsRangeSchema.safeParse({ from: "2026-01-01", to: "2026-08-25" }).success).toBe(false);
  });

  it("uses the configured raw-event retention window for summary queries", () => {
    const ninetyDays = createAnalyticsRangeSchema(90);
    const oneYear = createAnalyticsRangeSchema(365);
    expect(ninetyDays.safeParse({ from: "2026-05-01", to: "2026-08-25" }).success).toBe(false);
    expect(oneYear.safeParse({ from: "2026-01-01", to: "2026-08-25" }).success).toBe(true);
  });
});
