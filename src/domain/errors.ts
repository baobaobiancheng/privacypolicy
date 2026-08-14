export const DOMAIN_ERROR_CODES = [
  "FIELD_INVALID",
  "SCOPE_NOT_SUPPORTED",
  "PROJECT_REVISION_CONFLICT",
  "PROJECT_FORBIDDEN",
  "EXPORT_BLOCKED",
  "FORM_NOT_READY",
  "FORM_SEMANTIC_REVIEW_REQUIRED",
  "LAW_SEARCH_FAILED",
  "CONTENT_VERSION_INVALID",
  "CONTENT_VERSION_UNSUPPORTED",
  "DOCX_GENERATION_FAILED",
  "MODEL_NOT_CONFIGURED",
  "MODEL_REQUEST_FAILED",
  "MODEL_OUTPUT_INVALID",
  "DATABASE_UNAVAILABLE",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

const retryableCodes = new Set<DomainErrorCode>([
  "FIELD_INVALID",
  "PROJECT_REVISION_CONFLICT",
  "PROJECT_FORBIDDEN",
  "EXPORT_BLOCKED",
  "FORM_NOT_READY",
  "FORM_SEMANTIC_REVIEW_REQUIRED",
  "LAW_SEARCH_FAILED",
  "DOCX_GENERATION_FAILED",
  "MODEL_REQUEST_FAILED",
  "MODEL_OUTPUT_INVALID",
  "DATABASE_UNAVAILABLE",
]);

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly retryable: boolean;
  readonly fieldKey?: string;
  readonly details?: Readonly<Record<string, string>>;

  constructor(code: DomainErrorCode, message: string, options?: { fieldKey?: string; retryable?: boolean; details?: Record<string, string> }) {
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
  return new DomainError("DATABASE_UNAVAILABLE", "系统暂时无法完成操作，请稍后重试。", { retryable: true });
}
