import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ClientAnalyticsBatchSchema, normalizeAnalyticsPagePath } from "@/src/analytics/contract";
import { tenantAnalyticsRateLimiter } from "@/src/analytics/rate-limit";
import { requireDevActor } from "@/src/auth/session";
import { ensureDevUsers } from "@/src/data/dev-seed";
import { getPrisma } from "@/src/data/prisma";
import { createEntityId } from "@/src/domain/ids";
import { DomainError } from "@/src/domain/errors";
import { apiError, invalidInput } from "@/src/http/api-error";
import { withApiTiming } from "@/src/http/request-timing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withApiTiming(request, "/api/v1/analytics/events", async () => {
  try {
    const actor = requireDevActor(request);
    const rateLimit = tenantAnalyticsRateLimiter.check(actor.tenantId);
    if (!rateLimit.allowed) {
      throw new DomainError("RATE_LIMITED", "行为数据提交过于频繁，请稍后重试。", {
        retryable: true,
        details: { retryAfterSeconds: rateLimit.retryAfterSeconds },
      });
    }
    const parsed = ClientAnalyticsBatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw invalidInput("行为事件格式不正确。");
    await ensureDevUsers();
    const prisma = getPrisma();
    const now = Date.now();
    const projectIds = [...new Set(parsed.data.events.flatMap((event) => event.projectId ? [event.projectId] : []))];
    if (projectIds.length) {
      const accessibleCount = await prisma.project.count({ where: { id: { in: projectIds }, tenantId: actor.tenantId } });
      if (accessibleCount !== projectIds.length) throw invalidInput("行为事件中的项目无效。");
    }
    const rows = parsed.data.events.map((event) => {
      const occurredAt = new Date(event.occurredAt);
      if (occurredAt.getTime() < now - 24 * 60 * 60 * 1_000 || occurredAt.getTime() > now + 5 * 60 * 1_000) {
        throw invalidInput("行为事件时间无效。");
      }
      return {
        id: createEntityId("evt"),
        tenantId: actor.tenantId,
        userId: actor.userId,
        projectId: event.projectId ?? null,
        sessionId: event.sessionId,
        eventName: event.eventName,
        pagePath: normalizeAnalyticsPagePath(event.pagePath),
        durationMs: event.eventName === "PAGE_DURATION" ? event.durationMs : null,
        properties: event.properties as Prisma.InputJsonValue,
        occurredAt,
      };
    });
    await prisma.analyticsEvent.createMany({ data: rows });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, request, "行为数据记录失败。");
  }
  });
}
