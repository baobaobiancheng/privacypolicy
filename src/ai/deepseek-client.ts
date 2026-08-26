import { DomainError } from "@/src/domain/errors";

const MODEL_ENDPOINT = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 240_000;
const STREAM_IDLE_TIMEOUT_MS = 90_000;
const DEFAULT_STREAM_HARD_TIMEOUT_MS = 1_200_000;

export type DeepSeekMessage = { role: "system" | "user"; content: string };
export type DeepSeekResponse = { choices: Array<{ message: { content: string | null } }> };
export type DeepSeekStreamUpdate = {
  content: string;
  activityCount: number;
  reasoningCharacterCount: number;
  force: boolean;
};

type RequestOptions = {
  apiKey: string;
  model: string;
  messages: DeepSeekMessage[];
  maxTokens: number;
  temperature: number;
  thinking: boolean;
  signal?: AbortSignal;
};

export async function requestDeepSeekCompletion(options: RequestOptions): Promise<DeepSeekResponse> {
  const linked = linkedAbortController(options.signal);
  const timeout = setTimeout(() => linked.controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(MODEL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
      body: requestBody(options, false),
      signal: linked.controller.signal,
    });
    ensureSuccessfulResponse(response);
    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new DomainError("MODEL_OUTPUT_INVALID", "生成服务返回了无法解析的内容。", { retryable: true });
    }
    const choice = firstChoice(raw);
    if (!choice?.message) {
      throw new DomainError("MODEL_OUTPUT_INVALID", "生成服务没有返回完整草稿。", { retryable: true });
    }
    validateFinishReason(choice.finish_reason);
    return { choices: [{ message: { content: normalizeContent(choice.message.content) } }] };
  } catch (error) {
    throw mapRequestError(error, options.signal, "草稿生成超时，本次填写内容已保存，请稍后重试。");
  } finally {
    clearTimeout(timeout);
    linked.dispose();
  }
}

export async function requestDeepSeekStreamingCompletion(
  options: RequestOptions,
  onUpdate: (update: DeepSeekStreamUpdate) => void,
): Promise<DeepSeekResponse> {
  const linked = linkedAbortController(options.signal);
  let timeoutReason: "IDLE" | "HARD" | null = null;
  let idleTimeout: ReturnType<typeof setTimeout> | null = null;
  const resetIdleTimeout = () => {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      timeoutReason = "IDLE";
      linked.controller.abort();
    }, STREAM_IDLE_TIMEOUT_MS);
  };
  resetIdleTimeout();
  const hardTimeout = setTimeout(() => {
    timeoutReason = "HARD";
    linked.controller.abort();
  }, streamHardTimeoutMs());

  try {
    const response = await fetch(MODEL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
      body: requestBody(options, true),
      signal: linked.controller.signal,
    });
    ensureSuccessfulResponse(response);
    if (!response.body) {
      throw new DomainError("MODEL_OUTPUT_INVALID", "生成服务未返回可读取的正文。", { retryable: true });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let content = "";
    let finishReason: string | null = null;
    let activityCount = 0;
    let reasoningCharacterCount = 0;
    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") return;
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        return;
      }
      const choice = firstChoice(json);
      if (!choice) return;
      activityCount += 1;
      if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
      reasoningCharacterCount += normalizeContent(choice.delta?.reasoning_content)?.length ?? 0;
      content += normalizeContent(choice.delta?.content) ?? "";
      onUpdate({ content, activityCount, reasoningCharacterCount, force: false });
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (value?.byteLength) resetIdleTimeout();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
      if (done) break;
    }
    if (pending) consumeLine(pending);
    onUpdate({ content, activityCount, reasoningCharacterCount, force: true });
    validateFinishReason(finishReason);
    return { choices: [{ message: { content: content || null } }] };
  } catch (error) {
    const timeoutMessage = timeoutReason === "IDLE"
      ? "生成服务长时间未返回新内容，本次填写已保存，可直接重新生成。"
      : "政策生成超过最长处理时间，本次填写已保存，可直接重新生成。";
    throw mapRequestError(error, options.signal, timeoutMessage);
  } finally {
    if (idleTimeout) clearTimeout(idleTimeout);
    clearTimeout(hardTimeout);
    linked.dispose();
  }
}

function requestBody(options: RequestOptions, stream: boolean): string {
  return JSON.stringify({
    model: options.model,
    messages: options.messages,
    thinking: { type: options.thinking ? "enabled" : "disabled" },
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    stream,
  });
}

function ensureSuccessfulResponse(response: Response): void {
  if (!response.ok) {
    throw new DomainError("MODEL_REQUEST_FAILED", "DeepSeek 请求失败，请稍后重试。", {
      retryable: response.status >= 500 || response.status === 429,
    });
  }
}

function firstChoice(raw: unknown): {
  finish_reason?: unknown;
  message?: { content?: unknown };
  delta?: { content?: unknown; reasoning_content?: unknown };
} | undefined {
  return raw && typeof raw === "object" && Array.isArray((raw as { choices?: unknown }).choices)
    ? (raw as { choices: Array<{ finish_reason?: unknown; message?: { content?: unknown }; delta?: { content?: unknown; reasoning_content?: unknown } }> }).choices[0]
    : undefined;
}

function normalizeContent(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (part as { text?: string }).text || "").join("");
  return null;
}

function validateFinishReason(reason: unknown): void {
  if (reason === "length") {
    throw new DomainError("MODEL_OUTPUT_INVALID", "生成内容超出长度限制，未形成完整草稿。", { retryable: true });
  }
  if (reason === "content_filter") {
    throw new DomainError("MODEL_OUTPUT_INVALID", "生成内容未通过服务安全检查。", { retryable: false });
  }
  if (reason === "insufficient_system_resource") {
    throw new DomainError("MODEL_REQUEST_FAILED", "生成服务当前繁忙，请稍后重试。", { retryable: true });
  }
}

function linkedAbortController(externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  return {
    controller,
    dispose: () => externalSignal?.removeEventListener("abort", abortFromExternal),
  };
}

function mapRequestError(error: unknown, externalSignal: AbortSignal | undefined, timeoutMessage: string): unknown {
  if (externalSignal?.aborted) return externalSignal.reason ?? error;
  if (error instanceof DomainError) return error;
  if (isAbortError(error)) {
    return new DomainError("MODEL_REQUEST_FAILED", timeoutMessage, { retryable: true });
  }
  return new DomainError("MODEL_REQUEST_FAILED", "生成服务暂时无法连接，请稍后重试。", { retryable: true });
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
}

function streamHardTimeoutMs(): number {
  const configured = Number(process.env.DEEPSEEK_GENERATION_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 300_000 && configured <= 3_600_000
    ? configured
    : DEFAULT_STREAM_HARD_TIMEOUT_MS;
}
