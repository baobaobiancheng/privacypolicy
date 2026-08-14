import { NextResponse } from "next/server";
import { z } from "zod";
import { extractSupplementSlots } from "@/src/ai/deepseek";
import { isDevPersonaEnabled } from "@/src/auth/dev-personas";
import { isDomainError } from "@/src/domain/errors";

export const runtime = "nodejs";

const InputSchema = z.object({
  questionId: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  detail: z.string().trim().min(1).max(4_000),
}).strict();

export async function POST(request: Request) {
  if (!isDevPersonaEnabled()) return NextResponse.json({ code: "PROJECT_FORBIDDEN" }, { status: 404 });
  const parsed = InputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_SLOT_INPUT", message: "请先填写产品实际情况。" }, { status: 400 });

  try {
    const result = await extractSupplementSlots(parsed.data.questionId, parsed.data.detail);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ code: error.code, message: error.message, retryable: error.retryable }, { status: error.code === "MODEL_NOT_CONFIGURED" ? 503 : 422 });
    }
    return NextResponse.json({ code: "MODEL_REQUEST_FAILED", message: "智能整理暂时不可用，请直接填写固定字段。" }, { status: 502 });
  }
}
