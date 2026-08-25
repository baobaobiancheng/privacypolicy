import { DomainError } from "@/src/domain/errors";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MAX_ASSISTANT_FILES = 5;
export const MAX_ASSISTANT_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_TEXT_CHARS = 30_000;
export const MAX_TOTAL_ATTACHMENT_TEXT_CHARS = 60_000;

export type AssistantAttachmentKind = "DOCUMENT" | "SPREADSHEET" | "IMAGE" | "TEXT";

export type ExtractedAssistantAttachment = {
  name: string;
  mimeType: string;
  size: number;
  kind: AssistantAttachmentKind;
  text: string;
  truncated: boolean;
  ocrConfidence?: number;
};

let imageOcrTail: Promise<void> = Promise.resolve();

const supportedExtensions = new Set(["pdf", "docx", "txt", "md", "markdown", "json", "csv", "png", "jpg", "jpeg", "webp"]);

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export function isSupportedAssistantFile(file: Pick<File, "name" | "type">) {
  const extension = extensionOf(file.name);
  return supportedExtensions.has(extension)
    || file.type.startsWith("text/")
    || file.type.startsWith("image/");
}

export function normalizeAttachmentText(value: string) {
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  const truncated = normalized.length > MAX_ATTACHMENT_TEXT_CHARS;
  return {
    text: truncated ? normalized.slice(0, MAX_ATTACHMENT_TEXT_CHARS) : normalized,
    truncated,
  };
}

function attachmentKind(file: Pick<File, "name" | "type">): AssistantAttachmentKind {
  const extension = extensionOf(file.name);
  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)) return "IMAGE";
  if (extension === "csv") return "SPREADSHEET";
  if (file.type.startsWith("text/") || ["txt", "md", "markdown", "json"].includes(extension)) return "TEXT";
  return "DOCUMENT";
}

async function extractPdf(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractDocx(buffer: Buffer) {
  const mammoth = await import("mammoth");
  return (await mammoth.extractRawText({ buffer })).value;
}

async function withSerializedImageOcr<T>(task: () => Promise<T>): Promise<T> {
  const previous = imageOcrTail;
  let release!: () => void;
  imageOcrTail = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
  }
}

async function extractImageText(buffer: Buffer) {
  const tesseractModule = await import("tesseract.js");
  const tesseract = tesseractModule.default ?? tesseractModule;
  const cachePath = join(tmpdir(), "privacy-policy-tesseract-cache");
  await mkdir(cachePath, { recursive: true });
  return withSerializedImageOcr(async () => {
    const result = await tesseract.recognize(buffer, "chi_sim+eng", { cachePath });
    return { text: result.data.text, confidence: result.data.confidence };
  });
}

export function isMeaningfulImageText(text: string, confidence: number) {
  const meaningfulCharacters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  return meaningfulCharacters >= 6 && confidence >= 20;
}

export async function extractAssistantAttachment(file: File): Promise<ExtractedAssistantAttachment> {
  if (!file.name.trim() || file.size <= 0) throw new DomainError("FIELD_INVALID", "文件内容为空。", { retryable: false });
  if (file.size > MAX_ASSISTANT_FILE_BYTES) throw new DomainError("FIELD_INVALID", "单个文件不能超过 20 MB。", { retryable: false });
  if (!isSupportedAssistantFile(file)) throw new DomainError("FIELD_INVALID", "暂不支持该文件格式。", { retryable: false });

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = extensionOf(file.name);
  const kind = attachmentKind(file);
  let rawText = "";
  let ocrConfidence: number | undefined;
  try {
    if (kind === "IMAGE") {
      const extracted = await extractImageText(buffer);
      rawText = extracted.text;
      ocrConfidence = extracted.confidence;
    }
    else if (extension === "pdf" || file.type === "application/pdf") rawText = await extractPdf(buffer);
    else if (extension === "docx") rawText = await extractDocx(buffer);
    else rawText = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  } catch {
    throw new DomainError("ATTACHMENT_PARSE_FAILED", "无法读取该文件，请确认文件未加密且内容完整。", { retryable: true });
  }

  const normalized = normalizeAttachmentText(rawText);
  if (!normalized.text || (kind === "IMAGE" && !isMeaningfulImageText(normalized.text, ocrConfidence ?? 0))) {
    throw new DomainError("ATTACHMENT_NO_TEXT", kind === "IMAGE" ? "图片中未识别到可读文字。" : "文件中未提取到可读文字。", { retryable: false });
  }
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind,
    text: normalized.text,
    truncated: normalized.truncated,
    ...(ocrConfidence === undefined ? {} : { ocrConfidence }),
  };
}
