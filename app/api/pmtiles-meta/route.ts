import { NextRequest, NextResponse } from "next/server";
import { fetchPMTilesMeta } from "@/lib/pmtiles-meta";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing `url` query parameter" },
      { status: 400 },
    );
  }

  // Basic validation
  if (!url.endsWith(".pmtiles")) {
    return NextResponse.json(
      { error: "URL must end with .pmtiles" },
      { status: 400 },
    );
  }

  try {
    const meta = await fetchPMTilesMeta(url);
    return NextResponse.json(meta, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[pmtiles-meta]", err);
    return NextResponse.json(
      { error: `Failed to read PMTiles metadata: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 500 },
    );
  }
}
