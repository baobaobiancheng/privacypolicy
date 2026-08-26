import { describe, expect, it } from "vitest";
import { generationRetryDelayMs } from "@/src/application/generation/job-service";
import { shouldRetryGeneration } from "@/src/application/generation/job-lease";

describe("generation retry backoff", () => {
  it("uses a 30 second first retry with bounded jitter", () => {
    expect(generationRetryDelayMs(1, () => 0)).toBe(24_000);
    expect(generationRetryDelayMs(1, () => 0.5)).toBe(30_000);
    expect(generationRetryDelayMs(1, () => 1)).toBe(36_000);
  });

  it("uses a two minute second retry with bounded jitter", () => {
    expect(generationRetryDelayMs(2, () => 0)).toBe(96_000);
    expect(generationRetryDelayMs(2, () => 0.5)).toBe(120_000);
    expect(generationRetryDelayMs(2, () => 1)).toBe(144_000);
  });

  it("clamps invalid random values into the supported jitter range", () => {
    expect(generationRetryDelayMs(1, () => -1)).toBe(24_000);
    expect(generationRetryDelayMs(1, () => 2)).toBe(36_000);
  });

  it("stops after three attempts and never retries a lost lease or terminal error", () => {
    expect(shouldRetryGeneration(true, 1, false)).toBe(true);
    expect(shouldRetryGeneration(true, 2, false)).toBe(true);
    expect(shouldRetryGeneration(true, 3, false)).toBe(false);
    expect(shouldRetryGeneration(false, 1, false)).toBe(false);
    expect(shouldRetryGeneration(true, 1, true)).toBe(false);
  });
});
