import { describe, expect, it } from "vitest";
import { assertContentIntegrity, computeContentHash } from "@/src/content/map-v1/integrity";
import { mapV1Content } from "@/src/content/map-v1";
import { ContentEnvelopeSchema, validateReferences } from "@/src/content/map-v1/schema";

describe("map-v1 内容包", () => {
  it("通过 schema、引用检查并保持稳定哈希", () => {
    expect(() => validateReferences(ContentEnvelopeSchema.parse(mapV1Content))).not.toThrow();
    expect(assertContentIntegrity(mapV1Content)).toBe(mapV1Content);
    expect(computeContentHash(mapV1Content)).toBe(mapV1Content.contentHash);
    expect(mapV1Content.payload.features).toHaveLength(5);
  });

  it("拒绝重复功能键", () => {
    const duplicate = structuredClone(mapV1Content);
    duplicate.payload.features[1].key = duplicate.payload.features[0].key;
    expect(() => validateReferences(duplicate)).toThrow("CONTENT_DUPLICATE_FEATURE_KEY");
  });

  it("拒绝不存在的证据引用", () => {
    const invalid = structuredClone(mapV1Content);
    invalid.payload.features[0].sourceRefs = ["MISSING-EVIDENCE"];
    expect(() => validateReferences(invalid)).toThrow("CONTENT_REFERENCE_INVALID");
  });
});
