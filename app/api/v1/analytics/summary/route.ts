import { NextResponse } from "next/server";
import { AnalyticsRangeSchema } from "@/src/analytics/contract";
import { getAnalyticsSummary } from "@/src/analytics/server";
import { requireDevActor } from "@/src/auth/session";
import { apiError, invalidInput } from "@/src/http/api-error";
import { withApiTiming } from "@/src/http/request-timing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withApiTiming(request, "/api/v1/analytics/summary", async () => {
  try {
    const actor = requireDevActor(request);
    const url = new URL(request.url);
    const parsed = AnalyticsRangeSchema.safeParse({
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    if (!parsed.success) throw invalidInput(parsed.error.issues[0]?.message ?? "统计时间范围无效。");
    const data = await getAnalyticsSummary(actor, parsed.data);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, request, "行为统计查询失败。");
  }
  });
}
