type BrowserCrypto = {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
};

function availableBrowserCrypto(): BrowserCrypto | null {
  if (typeof globalThis === "undefined" || !("crypto" in globalThis)) return null;
  return globalThis.crypto as unknown as BrowserCrypto;
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a browser-local identifier without assuming a secure context.
 * `crypto.randomUUID()` is unavailable in some browsers over plain HTTP,
 * while `crypto.getRandomValues()` remains the preferred compatible fallback.
 */
export function createBrowserId(
  cryptoApi: BrowserCrypto | null = availableBrowserCrypto(),
  now: () => number = Date.now,
  random: () => number = Math.random,
): string {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuid(bytes);
  }

  const timestamp = Math.max(0, Math.trunc(now())).toString(16).padStart(12, "0").slice(-12);
  const entropy = Math.floor(Math.max(0, Math.min(0.9999999999999999, random())) * 0xffffffffffff)
    .toString(16)
    .padStart(12, "0");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-4000-8000-${entropy}`;
}
