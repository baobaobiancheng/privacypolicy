import { createHash } from "node:crypto";
import type { MapV1Content } from "./schema";

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => key !== "contentHash").sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeContentHash(content: Omit<MapV1Content, "contentHash"> | MapV1Content): string {
  return `sha256:${createHash("sha256").update(canonicalize(content)).digest("hex")}`;
}

export function assertContentIntegrity(content: MapV1Content): MapV1Content {
  const actual = computeContentHash(content);
  if (actual !== content.contentHash) {
    throw new Error(`CONTENT_HASH_INVALID:expected=${content.contentHash};actual=${actual}`);
  }
  return content;
}
