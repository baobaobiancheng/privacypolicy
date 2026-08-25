import { NextResponse } from "next/server";
import { requireDevActor } from "@/src/auth/session";
import { getPrisma } from "@/src/data/prisma";
import { loadProject } from "@/src/data/project-repository";
import { DomainError } from "@/src/domain/errors";
import { apiError, getRequestId } from "@/src/http/api-error";
import { requireEntityId } from "@/src/http/route-params";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ projectId: string; reportId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const actor = requireDevActor(request);
    const routeParams = await params;
    const projectId = requireEntityId(routeParams.projectId, "prj", "项目 ID");
    const reportId = requireEntityId(routeParams.reportId, "rpt", "报告 ID");
    const prisma = getPrisma();
    await loadProject(actor, projectId, "READ", prisma);
    const report = await prisma.report.findFirst({
      where: { id: reportId, projectId },
      select: { id: true, projectRevision: true, state: true, filename: true, markdown: true, createdAt: true },
    });
    if (!report) throw new DomainError("REPORT_NOT_FOUND", "报告不存在。", { retryable: false });
    const requestId = getRequestId(request);
    return NextResponse.json({
      data: {
        ...report,
        createdAt: report.createdAt.toISOString(),
        downloadUrl: `/api/v1/projects/${projectId}/reports/${report.id}/content`,
      },
      requestId,
    }, { headers: { "Cache-Control": "private, no-store", "x-request-id": requestId } });
  } catch (error) {
    return apiError(error, request, "报告加载失败。");
  }
}
