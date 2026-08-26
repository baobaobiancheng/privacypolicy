import { describe, expect, it, vi } from "vitest";
import { ProjectSaveCoordinator } from "@/src/workspace/project-save-coordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("ProjectSaveCoordinator", () => {
  it("keeps one request in flight and stores only the newest queued snapshot", async () => {
    const first = deferred<{ kind: "saved"; revision: number }>();
    const transport = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ kind: "saved", revision: 2 });
    const coordinator = new ProjectSaveCoordinator({ revision: 0, transport });

    const firstFlush = coordinator.flush({ buildSnapshot: () => ({ value: "first" }), stepKey: "profile", version: 1 });
    await Promise.resolve();
    const latestFlush = coordinator.flush({ buildSnapshot: () => ({ value: "latest" }), stepKey: "processing", version: 3 });

    expect(transport).toHaveBeenCalledTimes(1);
    first.resolve({ kind: "saved", revision: 1 });
    await latestFlush;
    await firstFlush;

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.slice(0, 3)).toEqual([{ value: "latest" }, "processing", 1]);
  });

  it("does not enqueue the same snapshot again while it is already saving", async () => {
    const gate = deferred<{ kind: "saved"; revision: number }>();
    const transport = vi.fn(() => gate.promise);
    const coordinator = new ProjectSaveCoordinator({ revision: 1, transport });
    const request = { buildSnapshot: () => ({ value: "same" }), stepKey: "generate", version: 4 };

    const scheduledSave = coordinator.flush(request);
    await Promise.resolve();
    const flushedSave = coordinator.flush(request);
    gate.resolve({ kind: "saved", revision: 2 });

    await expect(scheduledSave).resolves.toEqual({ kind: "saved", revision: 2 });
    await expect(flushedSave).resolves.toEqual({ kind: "saved", revision: 2 });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not write again when flush sees an already saved form version", async () => {
    const transport = vi.fn().mockResolvedValue({ kind: "saved", revision: 2 });
    const coordinator = new ProjectSaveCoordinator({ revision: 1, transport });
    const request = { buildSnapshot: () => ({ value: "same" }), stepKey: "generate", version: 1 };

    await expect(coordinator.flush(request)).resolves.toEqual({ kind: "saved", revision: 2 });
    await expect(coordinator.flush(request)).resolves.toEqual({ kind: "saved", revision: 2 });

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("stops on a revision conflict without overwriting or retrying", async () => {
    const onConflict = vi.fn();
    const transport = vi.fn().mockResolvedValue({ kind: "conflict", currentRevision: 8 });
    const coordinator = new ProjectSaveCoordinator({ revision: 7, transport, onConflict });

    const result = await coordinator.flush({ buildSnapshot: () => ({ local: true }), stepKey: "profile", version: 1 });
    coordinator.schedule({ buildSnapshot: () => ({ local: "newer" }), stepKey: "profile", version: 2 });

    expect(result).toEqual({ kind: "conflict", currentRevision: 8 });
    expect(onConflict).toHaveBeenCalledWith(8);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("aborts an in-flight request when cancelled", async () => {
    const transport = vi.fn((_snapshot: unknown, _step: string, _revision: number, signal: AbortSignal) => new Promise<{ kind: "error"; message: string }>((resolve) => {
      signal.addEventListener("abort", () => resolve({ kind: "error", message: "aborted" }), { once: true });
    }));
    const coordinator = new ProjectSaveCoordinator({ revision: 0, transport });
    const saving = coordinator.flush({ buildSnapshot: () => ({}), stepKey: "profile", version: 1 });
    await Promise.resolve();

    coordinator.cancel();
    await saving;

    expect(transport.mock.calls[0]?.[3].aborted).toBe(true);
  });

  it("does not discard the latest queued edit when an older save fails", async () => {
    const first = deferred<{ kind: "error"; message: string }>();
    const transport = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ kind: "saved", revision: 2 });
    const coordinator = new ProjectSaveCoordinator({ revision: 1, transport });

    const firstSave = coordinator.flush({ buildSnapshot: () => ({ value: "old" }), stepKey: "profile", version: 1 });
    await Promise.resolve();
    const latestSave = coordinator.flush({ buildSnapshot: () => ({ value: "latest" }), stepKey: "processing", version: 2 });
    first.resolve({ kind: "error", message: "temporary failure" });

    await firstSave;
    await latestSave;

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.slice(0, 3)).toEqual([{ value: "latest" }, "processing", 1]);
  });
});
