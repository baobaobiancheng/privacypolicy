import { NextResponse } from "next/server";
import { createEntityId } from "@/src/domain/ids";
import { DomainError, type DomainErrorCode, isDomainError } from "@/src/domain/errors";

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  FIELD_INVALID: 400,
  PROJECT_NOT_FOUND: 404,
  PROJECT_REVISION_CONFLICT: 409,
  PROJECT_FORBIDDEN: 403,
  CATEGORY_NOT_AVAILABLE: 409,
  EXPORT_BLOCKED: 422,
  FORM_NOT_READY: 422,
  FORM_SEMANTIC_REVIEW_REQUIRED: 422,
  GENERATION_IN_PROGRESS: 409,
  GENERATION_NOT_FOUND: 404,
  REPORT_NOT_FOUND: 404,
  LAW_SEARCH_FAILED: 502,
  CONTENT_VERSION_INVALID: 500,
  CONTENT_VERSION_UNSUPPORTED: 422,
  DOCX_GENERATION_FAILED: 500,
  MODEL_NOT_CONFIGURED: 503,
  MODEL_REQUEST_FAILED: 502,
  MODEL_OUTPUT_INVALID: 502,
  ATTACHMENT_PARSE_FAILED: 422,
  ATTACHMENT_NO_TEXT: 422,
  DATABASE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  RATE_LIMITED: 429,
};

export function getRequestId(request?: Request): string {
  const supplied = request?.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 64 ? supplied : createEntityId("req");
}

export function apiError(error: unknown, request?: Request, fallbackMessage = "系统暂时无法完成操作，请稍后重试。") {
  const requestId = getRequestId(request);
  const domainError = isDomainError(error)
    ? error
    : new DomainError("INTERNAL_ERROR", fallbackMessage, { retryable: false });
  const status = STATUS_BY_CODE[domainError.code];

  if (status >= 500) {
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        code: domainError.code,
        message: domainError.message,
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
  }

  return NextResponse.json(
    {
      error: {
        code: domainError.code,
        message: domainError.message,
        retryable: domainError.retryable,
        requestId,
        details: {
          ...(domainError.fieldKey ? { fieldKey: domainError.fieldKey } : {}),
          ...(domainError.details ?? {}),
        },
      },
    },
    { status, headers: { "x-request-id": requestId } },
  );
}

export function invalidInput(message: string, details?: Record<string, unknown>): DomainError {
  return new DomainError("FIELD_INVALID", message, { retryable: false, details });
}
