import { randomBytes } from "node:crypto";

export const ENTITY_ID_PREFIXES = ["prj", "gen", "rpt", "req", "aud", "evt"] as const;

export type EntityIdPrefix = (typeof ENTITY_ID_PREFIXES)[number];

function uuidV7(now: number): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 0xffffffffffff) {
    throw new RangeError("UUIDv7 timestamp must fit in 48 bits.");
  }

  const bytes = randomBytes(16);
  let timestamp = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createEntityId(prefix: EntityIdPrefix, now = Date.now()): string {
  return `${prefix}_${uuidV7(now)}`;
}

export function isEntityId(value: string, prefix?: EntityIdPrefix): boolean {
  const allowedPrefix = prefix ? prefix : `(?:${ENTITY_ID_PREFIXES.join("|")})`;
  return new RegExp(
    `^${allowedPrefix}_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
    "i",
  ).test(value);
}
