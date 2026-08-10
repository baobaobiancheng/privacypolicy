import { NextResponse } from "next/server";
import { verifiedMapV1Content } from "@/src/content/map-v1/server-content";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    contentVersion: verifiedMapV1Content.contentVersion,
    contentHash: verifiedMapV1Content.contentHash,
    category: verifiedMapV1Content.payload.category,
  });
}
