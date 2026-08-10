import rawContent from "./map-v1.0.0.json";
import { ContentEnvelopeSchema, validateReferences, type MapV1Content } from "./schema";

export const mapV1Content: MapV1Content = validateReferences(ContentEnvelopeSchema.parse(rawContent));

export function getMapFeature(featureKey: string) {
  return mapV1Content.payload.features.find((feature) => feature.key === featureKey) ?? null;
}

export function getEvidence(evidenceId: string) {
  return mapV1Content.payload.evidence.find((evidence) => evidence.id === evidenceId) ?? null;
}
