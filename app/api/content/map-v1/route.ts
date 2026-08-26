import { NextResponse } from "next/server";
import { verifiedMapV1Content } from "@/src/content/map-v1/server-content";
import { withApiTiming } from "@/src/http/request-timing";

export const runtime = "nodejs";

export function GET(request: Request) {
  return withApiTiming(request, "/api/content/map-v1", async () => NextResponse.json({
    contentVersion: verifiedMapV1Content.contentVersion,
    contentHash: verifiedMapV1Content.contentHash,
    category: verifiedMapV1Content.payload.category,
  }));
}
