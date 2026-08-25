import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDevActor } from "@/src/auth/session";
import { getPrisma } from "@/src/data/prisma";
import { enqueueGeneration } from "@/src/application/generation/job-service";
import { apiError, getRequestId, invalidInput } from "@/src/http/api-error";
import { requireEntityId } from "@/src/http/route-params";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ projectId: string }> };
const BodySchema = z.object({ idempotencyKey: z.string().trim().min(8).max(128) }).strict();

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actor = requireDevActor(request);
    const projectId = requireEntityId((await params).projectId, "prj", "项目 ID");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw invalidInput("生成请求格式无效。", { issues: parsed.error.flatten() });
    const requestId = getRequestId(request);
    const { job, reused } = await enqueueGeneration(getPrisma(), actor, projectId, parsed.data.idempotencyKey, requestId);
    return NextResponse.json({ data: job, requestId }, {
      status: reused && ["SUCCEEDED", "FAILED", "SUPERSEDED"].includes(job.state) ? 200 : 202,
      headers: {
        Location: `/api/v1/projects/${projectId}/generations/${job.id}`,
        "Retry-After": "2",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, request, "生成任务创建失败。");
  }
}
