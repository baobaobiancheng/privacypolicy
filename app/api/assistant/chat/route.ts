import { NextResponse } from "next/server";
import { AssistantChatRequestSchema, chatWithPrivacyAssistant } from "@/src/ai/privacy-assistant";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { requireDevActor, type SessionActor } from "@/src/auth/session";
import { isDomainError } from "@/src/domain/errors";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
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
  if (!isDevPersonaEnabled()) return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  let actor: SessionActor;
  try {
    actor = requireDevActor(request);
  } catch (error) {
    if (isDomainError(error)) return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status: 403 });
    throw error;
  }
  if (rateLimited(`${actor.tenantId}:${actor.userId}`)) {
    return NextResponse.json({ code: "RATE_LIMITED", message: "提问过于频繁，请稍后再试。", retryable: true }, { status: 429 });
  }
  const parsed = AssistantChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "FIELD_INVALID", message: "对话内容格式不正确。", retryable: false }, { status: 400 });
  }
  try {
    const result = await chatWithPrivacyAssistant(parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isDomainError(error)) {
      const status = error.code === "MODEL_NOT_CONFIGURED" ? 503 : 502;
      return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status });
    }
    return NextResponse.json({ code: "MODEL_REQUEST_FAILED", message: "AI 助手暂时无法连接，请稍后重试。", retryable: true }, { status: 502 });
  }
}
