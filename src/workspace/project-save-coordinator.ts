export type ProjectSaveRequest<T> = {
  buildSnapshot: () => T;
  stepKey: string;
  version: number;
};

export type ProjectSaveTransportResult =
  | { kind: "saved"; revision: number }
  | { kind: "conflict"; currentRevision: number | null }
  | { kind: "error"; message: string };

export type ProjectSaveResult = ProjectSaveTransportResult | { kind: "cancelled" };

type TimerHandle = ReturnType<typeof setTimeout>;

type ProjectSaveCoordinatorOptions<T> = {
  revision: number;
  debounceMs?: number;
  transport: (
    snapshot: T,
    stepKey: string,
    expectedRevision: number,
    signal: AbortSignal,
  ) => Promise<ProjectSaveTransportResult>;
  onStateChange?: (state: "idle" | "saving" | "saved" | "error" | "conflict") => void;
  onSaved?: (revision: number, request: ProjectSaveRequest<T>) => void;
  onConflict?: (currentRevision: number | null) => void;
};

/**
 * Serializes every project save through one in-flight request. New edits replace
 * queued work, while flush() waits until the newest queued snapshot is stored.
 */
export class ProjectSaveCoordinator<T> {
  private revision: number;
  private readonly debounceMs: number;
  private readonly transport: ProjectSaveCoordinatorOptions<T>["transport"];
  private readonly onStateChange?: ProjectSaveCoordinatorOptions<T>["onStateChange"];
  private readonly onSaved?: ProjectSaveCoordinatorOptions<T>["onSaved"];
  private readonly onConflict?: ProjectSaveCoordinatorOptions<T>["onConflict"];
  private queued: ProjectSaveRequest<T> | null = null;
  private inFlight: ProjectSaveRequest<T> | null = null;
  private timer: TimerHandle | null = null;
  private drainPromise: Promise<ProjectSaveResult> | null = null;
  private controller: AbortController | null = null;
  private cancelled = false;
  private conflicted = false;
  private lastSavedVersion = 0;
  private lastResult: ProjectSaveResult = { kind: "cancelled" };

  constructor(options: ProjectSaveCoordinatorOptions<T>) {
    this.revision = options.revision;
    this.debounceMs = options.debounceMs ?? 400;
    this.transport = options.transport;
    this.onStateChange = options.onStateChange;
    this.onSaved = options.onSaved;
    this.onConflict = options.onConflict;
  }

  setRevision(revision: number): void {
    this.revision = revision;
    this.conflicted = false;
  }

  schedule(request: ProjectSaveRequest<T>): void {
    if (this.cancelled || this.conflicted) return;
    if (request.version <= this.lastSavedVersion) return;
    if (this.inFlight && request.version < this.inFlight.version) return;
    if (this.queued && request.version < this.queued.version) return;
    if (this.inFlight?.version === request.version && this.inFlight.stepKey === request.stepKey) return;
    this.queued = request;
    this.onStateChange?.("saving");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.ensureDrain();
    }, this.debounceMs);
  }

  async flush(request?: ProjectSaveRequest<T>): Promise<ProjectSaveResult> {
    if (this.cancelled) return { kind: "cancelled" };
    if (request) {
      const isAlreadySaved = request.version <= this.lastSavedVersion;
      const isAlreadySavingSameSnapshot = this.inFlight?.version === request.version
        && this.inFlight.stepKey === request.stepKey;
      const isOlderThanPendingSnapshot = (this.inFlight?.version ?? -1) > request.version
        || (this.queued?.version ?? -1) > request.version;
      if (!isAlreadySaved && !isAlreadySavingSameSnapshot && !isOlderThanPendingSnapshot) {
        this.queued = request;
      }
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.conflicted) return this.lastResult;
    if (!this.queued && !this.inFlight && request && request.version <= this.lastSavedVersion) {
      return { kind: "saved", revision: this.revision };
    }
    return this.ensureDrain();
  }

  cancel(): void {
    this.cancelled = true;
    this.queued = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
    this.onStateChange?.("idle");
  }

  private ensureDrain(): Promise<ProjectSaveResult> {
    if (this.drainPromise) return this.drainPromise;
    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = null;
      if (this.queued && !this.cancelled && !this.conflicted) void this.ensureDrain();
    });
    return this.drainPromise;
  }

  private async drain(): Promise<ProjectSaveResult> {
    while (this.queued && !this.cancelled && !this.conflicted) {
      const request = this.queued;
      this.queued = null;
      this.inFlight = request;
      this.controller = new AbortController();
      this.onStateChange?.("saving");
      let result: ProjectSaveTransportResult;
      try {
        result = await this.transport(
          request.buildSnapshot(),
          request.stepKey,
          this.revision,
          this.controller.signal,
        );
      } catch (error) {
        result = this.controller.signal.aborted
          ? { kind: "error", message: "保存已取消。" }
          : { kind: "error", message: error instanceof Error ? error.message : "保存失败。" };
      } finally {
        this.controller = null;
        this.inFlight = null;
      }

      this.lastResult = result;
      if (result.kind === "saved") {
        this.revision = result.revision;
        this.lastSavedVersion = Math.max(this.lastSavedVersion, request.version);
        this.onSaved?.(result.revision, request);
        this.onStateChange?.(this.queued ? "saving" : "saved");
        continue;
      }
      if (result.kind === "conflict") {
        this.conflicted = true;
        this.queued = null;
        this.onStateChange?.("conflict");
        this.onConflict?.(result.currentRevision);
        return result;
      }
      if (this.queued) {
        this.onStateChange?.("saving");
        continue;
      }
      this.onStateChange?.("error");
      return result;
    }
    return this.lastResult.kind === "cancelled" ? { kind: "cancelled" } : this.lastResult;
  }
}
