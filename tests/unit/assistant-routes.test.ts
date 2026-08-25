import { afterEach, describe, expect, it } from "vitest";
import { POST as uploadAttachment } from "@/app/api/assistant/attachments/route";
import { POST as chat } from "@/app/api/assistant/chat/route";

describe("assistant route authentication", () => {
  afterEach(() => {
    delete process.env.ALLOW_DEV_PERSONA;
  });

  it.each([
    ["attachment", uploadAttachment, "multipart/form-data"],
    ["chat", chat, "application/json"],
  ])("returns a structured 403 for an unknown persona on %s", async (_name, handler, contentType) => {
    process.env.ALLOW_DEV_PERSONA = "1";
    const response = await handler(new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": contentType, "x-persona-id": "unknown-persona" },
      body: contentType === "application/json" ? "{}" : "invalid multipart body",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "PROJECT_FORBIDDEN" });
  });
});
