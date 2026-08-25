import { requireDevActor } from "@/src/auth/session";
import { getPrisma } from "@/src/data/prisma";
import { loadProject } from "@/src/data/project-repository";
import { DomainError } from "@/src/domain/errors";
import { apiError, getRequestId } from "@/src/http/api-error";
import { MysqlReportStorage } from "@/src/storage/report-storage";
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
    const report = await prisma.report.findFirst({ where: { id: reportId, projectId }, select: { id: true, filename: true } });
    if (!report) throw new DomainError("REPORT_NOT_FOUND", "报告不存在。", { retryable: false });
    const content = await new MysqlReportStorage(prisma).read(report.id);
    const requestId = getRequestId(request);
    return new Response(new Blob([new Uint8Array(content)]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(report.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, request, "报告下载失败。");
  }
}
