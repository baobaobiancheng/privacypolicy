import { after, NextResponse } from "next/server";
import { MAX_ASSISTANT_FILE_BYTES, extractAssistantAttachment } from "@/src/ai/assistant-attachments";
import { recordAnalyticsEventSafely } from "@/src/analytics/server";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { requireDevActor, type SessionActor } from "@/src/auth/session";
import { isDomainError } from "@/src/domain/errors";
import { withApiTiming } from "@/src/http/request-timing";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const MULTIPART_OVERHEAD_ALLOWANCE = 1024 * 1024;
const buckets = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}

export async function POST(request: Request) {
  return withApiTiming(request, "/api/assistant/attachments", async () => {
  if (!isDevPersonaEnabled()) return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  let actor: SessionActor;
  try {
    actor = requireDevActor(request);
  } catch (error) {
    if (isDomainError(error)) return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status: 403 });
    throw error;
  }
  const recordUpload = (success: boolean, errorCode?: string, mimeType?: string) => recordAnalyticsEventSafely({
    actor,
    eventName: success ? "FILE_UPLOAD_SUCCEEDED" : "FILE_UPLOAD_FAILED",
    properties: {
      ...(errorCode ? { errorCode } : {}),
      ...(mimeType ? { mimeGroup: mimeType.split("/")[0] || "unknown" } : {}),
    },
  });
  if (rateLimited(`${actor.tenantId}:${actor.userId}`)) {
    after(() => recordUpload(false, "RATE_LIMITED"));
    return NextResponse.json({ code: "RATE_LIMITED", message: "文件读取过于频繁，请稍后再试。", retryable: true }, { status: 429 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_ASSISTANT_FILE_BYTES + MULTIPART_OVERHEAD_ALLOWANCE) {
    after(() => recordUpload(false, "FILE_TOO_LARGE"));
    return NextResponse.json({ code: "FIELD_INVALID", message: "单个文件不能超过 20 MB。", retryable: false }, { status: 413 });
  }
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    after(() => recordUpload(false, "FILE_MISSING"));
    return NextResponse.json({ code: "FIELD_INVALID", message: "请选择要读取的文件。", retryable: false }, { status: 400 });
  }
  try {
    const attachment = await extractAssistantAttachment(file);
    after(() => recordUpload(true, undefined, file.type));
    return NextResponse.json(attachment, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isDomainError(error)) {
      after(() => recordUpload(false, error.code, file.type));
      return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status: error.retryable ? 422 : 400 });
    }
    after(() => recordUpload(false, "ATTACHMENT_PARSE_FAILED", file.type));
    return NextResponse.json({ code: "ATTACHMENT_PARSE_FAILED", message: "文件读取失败，请稍后重试。", retryable: true }, { status: 500 });
  }
  });
}
