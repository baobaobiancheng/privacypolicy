export const DOMAIN_ERROR_CODES = [
  "FIELD_INVALID",
  "PROJECT_NOT_FOUND",
  "PROJECT_REVISION_CONFLICT",
  "PROJECT_FORBIDDEN",
  "CATEGORY_NOT_AVAILABLE",
  "EXPORT_BLOCKED",
  "FORM_NOT_READY",
  "FORM_SEMANTIC_REVIEW_REQUIRED",
  "GENERATION_IN_PROGRESS",
  "GENERATION_NOT_FOUND",
  "REPORT_NOT_FOUND",
  "LAW_SEARCH_FAILED",
  "CONTENT_VERSION_INVALID",
  "CONTENT_VERSION_UNSUPPORTED",
  "DOCX_GENERATION_FAILED",
  "MODEL_NOT_CONFIGURED",
  "MODEL_REQUEST_FAILED",
  "MODEL_OUTPUT_INVALID",
  "ATTACHMENT_PARSE_FAILED",
  "ATTACHMENT_NO_TEXT",
  "DATABASE_UNAVAILABLE",
  "INTERNAL_ERROR",
  "RATE_LIMITED",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

const retryableCodes = new Set<DomainErrorCode>([
  "PROJECT_REVISION_CONFLICT",
  "GENERATION_IN_PROGRESS",
  "LAW_SEARCH_FAILED",
  "DOCX_GENERATION_FAILED",
  "MODEL_REQUEST_FAILED",
  "MODEL_OUTPUT_INVALID",
  "ATTACHMENT_PARSE_FAILED",
  "DATABASE_UNAVAILABLE",
  "RATE_LIMITED",
]);

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly retryable: boolean;
  readonly fieldKey?: string;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: DomainErrorCode,
    message: string,
    options?: { fieldKey?: string; retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.retryable = options?.retryable ?? retryableCodes.has(code);
    this.fieldKey = options?.fieldKey;
    this.details = options?.details;
  }

  toPublicJSON() {
    return {
      code: this.code,
      retryable: this.retryable,
      ...(this.fieldKey ? { fieldKey: this.fieldKey } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function toDomainError(error: unknown): DomainError {
  if (isDomainError(error)) return error;
  return new DomainError("INTERNAL_ERROR", "系统暂时无法完成操作，请联系管理员并提供请求编号。", { retryable: false });
}
