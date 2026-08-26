import { describe, expect, it, vi } from "vitest";
import {
  clearProjectCreationKey,
  PROJECT_CREATION_KEY_STORAGE,
  resolveProjectCreationKey,
} from "@/src/workspace/project-creation-key";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("project creation idempotency key", () => {
  it("reuses the same session key after a response is lost", () => {
    const storage = memoryStorage();
    const create = vi.fn()
      .mockReturnValueOnce("project-create-first")
      .mockReturnValueOnce("project-create-second");

    const first = resolveProjectCreationKey(storage, null, create);
    const retriedAfterReload = resolveProjectCreationKey(storage, null, create);

    expect(first).toBe("project-create-first");
    expect(retriedAfterReload).toBe(first);
    expect(storage.getItem(PROJECT_CREATION_KEY_STORAGE)).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("clears the pending key only after project creation succeeds", () => {
    const storage = memoryStorage();
    storage.setItem(PROJECT_CREATION_KEY_STORAGE, "project-create-first");

    clearProjectCreationKey(storage);

    expect(storage.getItem(PROJECT_CREATION_KEY_STORAGE)).toBeNull();
  });
});
