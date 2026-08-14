import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DomainError } from "@/src/domain/errors";

const ENDPOINT = "https://mcpgateway.100credit.cn/mcp";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_KEYWORDS = 5;
const ROWS_PER_KEYWORD = 3;

const LawSearchItemSchema = z.object({
  lawId: z.string().min(1),
  lawName: z.string().min(1).max(500),
  issuingOrgan: z.string().max(500).optional().default(""),
  issuingNo: z.string().max(500).optional().default(""),
  releaseYearMonthDate: z.string().max(100).optional().default(""),
  implementYearMonthDate: z.string().max(100).optional().default(""),
  timeliness: z.string().max(100).optional().default(""),
}).passthrough();

export type LawKeywordSearchResult = {
  keyword: string;
  laws: Array<z.infer<typeof LawSearchItemSchema>>;
};

type Credential = { appKey: string; appSecret: string };

/**
 * Uses only lawstar's deterministic keyword query. It never invokes semantic
 * search or a detail endpoint, keeping the cost and retrieval scope bounded.
 */
export async function searchLawsByKeywords(keywords: string[]): Promise<LawKeywordSearchResult[]> {
  const normalized = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))].slice(0, MAX_KEYWORDS);
  if (normalized.length === 0) return [];
  const credential = await loadCredential();
  const results: LawKeywordSearchResult[] = [];
  for (const keyword of normalized) results.push(await keywordSearch(keyword, credential));
  return results;
}

async function keywordSearch(keyword: string, credential: Credential): Promise<LawKeywordSearchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "X-App-Key": credential.appKey,
        "X-App-Secret": credential.appSecret,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `privacy-policy-${Date.now().toString(36)}-${keyword.length}`,
        method: "tools/call",
        params: {
          name: "lawstar_data_professional_query",
          arguments: { page: 1, rows: ROWS_PER_KEYWORD, keyword, timelinessnew: "1", synonym: "1" },
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const outer = await response.json() as { error?: unknown; result?: { isError?: boolean; content?: Array<{ text?: string }> } };
    if (outer.error || outer.result?.isError || !outer.result?.content?.[0]?.text) throw new Error("invalid MCP response");
    const inner = JSON.parse(outer.result.content[0].text) as { code?: string; data?: { lawdata?: unknown[] } };
    if (inner.code !== "200") throw new Error(`lawstar code ${inner.code ?? "unknown"}`);
    const laws = z.array(LawSearchItemSchema).parse(inner.data?.lawdata ?? []).map((law) => ({
      ...law,
      lawName: stripHtml(law.lawName),
      issuingOrgan: stripHtml(law.issuingOrgan),
    }));
    return { keyword, laws };
  } catch {
    throw new DomainError("LAW_SEARCH_FAILED", `法规关键词“${keyword}”查询失败，请稍后重新生成。`, { retryable: true });
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCredential(): Promise<Credential> {
  const fromEnv = {
    appKey: process.env.BAIJIAN_APP_KEY?.trim() ?? "",
    appSecret: process.env.BAIJIAN_APP_SECRET?.trim() ?? "",
  };
  if (fromEnv.appKey && fromEnv.appSecret) return fromEnv;

  // Local development may reuse the existing ignored credential file. A
  // production deployment must always use environment variables.
  if (process.env.NODE_ENV !== "production") {
    try {
      const filePath = path.resolve(process.cwd(), "../法规数据/调用代码/key.md");
      const text = await readFile(filePath, "utf8");
      const appKey = readCredentialLine(text, "key");
      const appSecret = readCredentialLine(text, "secret");
      if (appKey && appSecret) return { appKey, appSecret };
    } catch {
      // Fall through to the typed configuration error.
    }
  }
  throw new DomainError("LAW_SEARCH_FAILED", "法规关键词查询凭据尚未配置。", { retryable: false });
}

function readCredentialLine(text: string, key: string) {
  return text.match(new RegExp(`^${key}[：:]\\s*(.+)$`, "mi"))?.[1]?.trim() ?? "";
}

function normalizeKeyword(value: string) {
  return value.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
}
