export type AnalyticsSessionStorage = Pick<Storage, "getItem" | "setItem">;

const ANALYTICS_SESSION_ID_PATTERN = /^ses_[a-f0-9-]{16,64}$/i;

export function resolveAnalyticsSessionId(
  storage: AnalyticsSessionStorage | null,
  memorySessionId: string | null,
  createId: () => string,
): string {
  if (memorySessionId) return memorySessionId;

  const created = `ses_${createId()}`;
  if (!storage) return created;

  try {
    const existing = storage.getItem("privacy-policy:analytics-session");
    if (existing && ANALYTICS_SESSION_ID_PATTERN.test(existing)) return existing;
    storage.setItem("privacy-policy:analytics-session", created);
  } catch {
    // Analytics must never interrupt the product when browser storage is unavailable.
  }
  return created;
}
