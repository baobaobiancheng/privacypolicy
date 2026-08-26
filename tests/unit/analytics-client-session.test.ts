import { describe, expect, it, vi } from "vitest";
import { resolveAnalyticsSessionId } from "@/src/analytics/client-session";

describe("analytics browser session", () => {
  it("reuses an existing browser session", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("ses_0198f2d3-1234-7abc-8def-1234567890ab"),
      setItem: vi.fn(),
    };
    expect(resolveAnalyticsSessionId(storage, null, () => "new-id")).toBe("ses_0198f2d3-1234-7abc-8def-1234567890ab");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("replaces a malformed stored session instead of poisoning every analytics batch", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("invalid-session"),
      setItem: vi.fn(),
    };
    expect(resolveAnalyticsSessionId(storage, null, () => "0198f2d3-1234-7abc-8def-1234567890ab"))
      .toBe("ses_0198f2d3-1234-7abc-8def-1234567890ab");
    expect(storage.setItem).toHaveBeenCalledWith(
      "privacy-policy:analytics-session",
      "ses_0198f2d3-1234-7abc-8def-1234567890ab",
    );
  });

  it("falls back to memory when browser storage is restricted", () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error("SecurityError"); }),
      setItem: vi.fn(),
    };
    expect(resolveAnalyticsSessionId(storage, null, () => "fallback-id")).toBe("ses_fallback-id");
    expect(resolveAnalyticsSessionId(storage, "ses_memory-id", () => "unused-id")).toBe("ses_memory-id");
  });
});
