import { z } from "zod";
import { analyticsRetentionDays } from "./config";

export const CLIENT_ANALYTICS_EVENT_NAMES = ["PAGE_VIEW", "PAGE_DURATION", "BUTTON_CLICK"] as const;
export const SERVER_ANALYTICS_EVENT_NAMES = [
  "FILE_UPLOAD_SUCCEEDED",
  "FILE_UPLOAD_FAILED",
  "WORD_DOWNLOADED",
  "AI_ASSISTANT_QUESTION",
] as const;
export const ANALYTICS_EVENT_NAMES = [...CLIENT_ANALYTICS_EVENT_NAMES, ...SERVER_ANALYTICS_EVENT_NAMES] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export function explicitAnalyticsAction(value: string | undefined): string | null {
  const candidate = value?.trim();
  return candidate && /^[a-z0-9_:/.-]{1,160}$/i.test(candidate) ? candidate : null;
}

export function normalizeAnalyticsPagePath(path: string): string {
  return path
    .replace(/^\/projects\/prj_[a-f0-9-]{36}(?=\/|$)/i, "/projects/:projectId")
    .replace(/(\/activities\/)[^/]+$/i, "$1:activityId");
}

const BaseClientEventSchema = z.object({
  sessionId: z.string().regex(/^ses_[a-f0-9-]{16,64}$/i),
  pagePath: z.string().startsWith("/").max(500),
  projectId: z.string().regex(/^prj_[a-f0-9-]{36}$/i).optional(),
  occurredAt: z.string().datetime(),
}).strict();

export const ClientAnalyticsEventSchema = z.discriminatedUnion("eventName", [
  BaseClientEventSchema.extend({
    eventName: z.literal("PAGE_VIEW"),
    properties: z.object({ referrerHost: z.string().max(255).optional() }).strict().default({}),
  }),
  BaseClientEventSchema.extend({
    eventName: z.literal("PAGE_DURATION"),
    durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1_000),
    properties: z.object({}).strict().default({}),
  }),
  BaseClientEventSchema.extend({
    eventName: z.literal("BUTTON_CLICK"),
    properties: z.object({
      action: z.string().trim().regex(/^[a-z0-9_:/.-]{1,160}$/i),
      target: z.enum(["button", "link", "role-button"]),
    }).strict(),
  }),
]);

export const ClientAnalyticsBatchSchema = z.object({
  events: z.array(ClientAnalyticsEventSchema).min(1).max(25),
}).strict();

export function createAnalyticsRangeSchema(retentionDays = analyticsRetentionDays()) {
  return z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }).transform(({ from, to }) => {
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1_000);
    return { from: start, to: end };
  }).superRefine(({ from, to }, context) => {
    if (from >= to) context.addIssue({ code: "custom", message: "统计开始时间必须早于结束时间。" });
    if (to.getTime() - from.getTime() > retentionDays * 24 * 60 * 60 * 1_000) {
      context.addIssue({ code: "custom", message: `单次统计范围不能超过原始埋点的 ${retentionDays} 天保留周期。` });
    }
  });
}

export const AnalyticsRangeSchema = createAnalyticsRangeSchema();

export type ClientAnalyticsEvent = z.infer<typeof ClientAnalyticsEventSchema>;
