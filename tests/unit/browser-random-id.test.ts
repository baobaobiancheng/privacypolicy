import { describe, expect, it, vi } from "vitest";
import { createBrowserId } from "@/src/browser/random-id";

describe("browser-compatible identifiers", () => {
  it("uses randomUUID when the browser exposes it", () => {
    const randomUUID = vi.fn(() => "0198f2d3-1234-4abc-8def-1234567890ab");
    expect(createBrowserId({ randomUUID })).toBe("0198f2d3-1234-4abc-8def-1234567890ab");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("uses getRandomValues when randomUUID is unavailable over plain HTTP", () => {
    const getRandomValues = vi.fn((values: Uint8Array) => {
      values.set(Array.from({ length: 16 }, (_, index) => index));
      return values;
    });

    expect(createBrowserId({ getRandomValues })).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("still creates a valid local identifier when Web Crypto is unavailable", () => {
    expect(createBrowserId(null, () => 1_775_000_000_000, () => 0.5))
      .toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4000-8000-[a-f0-9]{12}$/);
  });
});
