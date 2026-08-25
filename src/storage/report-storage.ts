import type { PrismaClient, ReportStorageKind } from "@prisma/client";
import { DomainError } from "@/src/domain/errors";

export type StoredReportDocument = {
  storageKind: ReportStorageKind;
  storageKey: string | null;
  docx: Buffer | null;
  docxHash: string;
};

export interface ReportStorage {
  prepare(reportId: string, docx: Buffer, docxHash: string): Promise<StoredReportDocument>;
  read(reportId: string): Promise<Buffer>;
}

/** Development storage. The interface keeps the worker independent from the
 * eventual object-storage choice and prevents binary data entering JSON APIs. */
export class MysqlReportStorage implements ReportStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async prepare(_reportId: string, docx: Buffer, docxHash: string): Promise<StoredReportDocument> {
    return { storageKind: "MYSQL", storageKey: null, docx, docxHash };
  }

  async read(reportId: string): Promise<Buffer> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId }, select: { docx: true } });
    if (!report?.docx) {
      throw new DomainError("REPORT_NOT_FOUND", "报告文件不存在。", { retryable: false });
    }
    return Buffer.from(report.docx);
  }
}
