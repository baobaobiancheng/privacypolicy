import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_TEXT_CHARS,
  extractAssistantAttachment,
  isMeaningfulImageText,
  isSupportedAssistantFile,
  normalizeAttachmentText,
} from "@/src/ai/assistant-attachments";
import { AssistantChatRequestSchema } from "@/src/ai/privacy-assistant";

describe("assistant attachments", () => {
  it("accepts the published document and image formats", () => {
    expect(isSupportedAssistantFile({ name: "policy.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })).toBe(true);
    expect(isSupportedAssistantFile({ name: "screen.png", type: "image/png" })).toBe(true);
    expect(isSupportedAssistantFile({ name: "program.exe", type: "application/octet-stream" })).toBe(false);
  });

  it("normalizes and deterministically truncates extracted text", () => {
    const result = normalizeAttachmentText(`一\r\n\r\n\r\n\r\n${"二".repeat(MAX_ATTACHMENT_TEXT_CHARS + 20)}`);
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(MAX_ATTACHMENT_TEXT_CHARS);
    expect(result.text).not.toContain("\r");
  });

  it("extracts UTF-8 text without storing the original file", async () => {
    const result = await extractAssistantAttachment(new File(["仅在导航期间收集位置信息。"], "notes.txt", { type: "text/plain" }));
    expect(result).toMatchObject({ name: "notes.txt", kind: "TEXT", text: "仅在导航期间收集位置信息。", truncated: false });
  });

  it("does not mark punctuation-only OCR output as understood", () => {
    expect(isMeaningfulImageText("、", 99)).toBe(false);
    expect(isMeaningfulImageText("后台定位仅在导航期间使用", 60)).toBe(true);
    expect(isMeaningfulImageText("后台定位仅在导航期间使用", 5)).toBe(false);
  });

  it("rejects attachment context beyond the total prompt budget", () => {
    const parsed = AssistantChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "检查资料" }],
      projectContext: {
        currentStep: "补充信息",
        productName: "",
        operatorName: "",
        selectedFeatures: [],
        processedInformation: [],
        additionalNotes: "",
      },
      attachments: [1, 2, 3].map((index) => ({
        id: `file-${index}`,
        name: `${index}.txt`,
        mimeType: "text/plain",
        kind: "TEXT",
        content: "x".repeat(25_000),
        truncated: false,
      })),
    });
    expect(parsed.success).toBe(false);
  });
});
