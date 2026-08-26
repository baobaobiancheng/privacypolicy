export const PROJECT_CREATION_KEY_STORAGE = "privacy-policy:pending-project-creation-key";

type CreationKeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function projectCreationStorage(): CreationKeyStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function resolveProjectCreationKey(
  storage: CreationKeyStorage | null,
  current: string | null,
  create: () => string,
): string {
  if (current) return current;
  try {
    const stored = storage?.getItem(PROJECT_CREATION_KEY_STORAGE);
    if (stored) return stored;
    const created = create();
    storage?.setItem(PROJECT_CREATION_KEY_STORAGE, created);
    return created;
  } catch {
    return create();
  }
}

export function clearProjectCreationKey(storage: CreationKeyStorage | null): void {
  try {
    storage?.removeItem(PROJECT_CREATION_KEY_STORAGE);
  } catch {
    // Project creation already succeeded; storage cleanup is best-effort.
  }
}
