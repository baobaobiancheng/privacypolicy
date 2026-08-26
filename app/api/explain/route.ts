import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTermExplanation } from "@/src/ai/deepseek";
import { fallbackTermExplanation, isExplainableTerm } from "@/src/ai/explain-terms";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { requireDevActor, type SessionActor } from "@/src/auth/session";
import { isDomainError } from "@/src/domain/errors";
import { withApiTiming } from "@/src/http/request-timing";

export const runtime = "nodejs";

const ExplainBodySchema = z.object({
  term: z.string().trim().min(1).max(40),
});

/**
 * 开发身份下的简单内存滑动窗口限流。dev persona 部署没有真实登录，
 * 这是防滥用/防成本泄漏的最低闸门；接入真实登录后应替换为账号级限流。
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const buckets = new Map<string, number[]>();

function rateLimited(actor: SessionActor): boolean {
  const now = Date.now();
  const key = `${actor.tenantId}:${actor.userId}`;
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
  return withApiTiming(request, "/api/explain", async () => {
  if (!isDevPersonaEnabled()) {
    return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  }
  const actor = requireDevActor(request);

  const parsed = ExplainBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_TERM" }, { status: 400 });
  }
  if (!isExplainableTerm(parsed.data.term)) {
    return NextResponse.json({ code: "UNKNOWN_TERM" }, { status: 400 });
  }
  if (rateLimited(actor)) {
    return NextResponse.json({ code: "RATE_LIMITED", retryable: true }, { status: 429 });
  }

  try {
    const result = await generateTermExplanation(parsed.data.term);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const fallback = fallbackTermExplanation(parsed.data.term);
    if (fallback) {
      return NextResponse.json({ ...fallback, source: "LOCAL_GLOSSARY" }, { headers: { "Cache-Control": "public, max-age=3600" } });
    }
    if (isDomainError(error)) return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status: 502 });
    return NextResponse.json({ code: "EXPLAIN_FAILED", message: "解释生成失败，请稍后重试。", retryable: true }, { status: 502 });
  }
  });
}
