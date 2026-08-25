import { NextResponse } from "next/server";
import { requireDevActor } from "@/src/auth/session";
import { getPrisma } from "@/src/data/prisma";
import { getGeneration } from "@/src/application/generation/job-service";
import { apiError, getRequestId } from "@/src/http/api-error";
import { requireEntityId } from "@/src/http/route-params";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ projectId: string; generationId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const actor = requireDevActor(request);
    const routeParams = await params;
    const projectId = requireEntityId(routeParams.projectId, "prj", "项目 ID");
    const generationId = requireEntityId(routeParams.generationId, "gen", "生成任务 ID");
    const job = await getGeneration(getPrisma(), actor, projectId, generationId);
    const requestId = getRequestId(request);
    return NextResponse.json({ data: job, requestId }, { headers: { "Cache-Control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return apiError(error, request, "生成任务加载失败。");
  }
}
