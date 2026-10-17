// GET /api/search?q=inception → { titles: Title[] }

import { NextRequest, NextResponse } from "next/server";
import { searchTitles } from "@/infrastructure/container";
import { catalogErrorResponse } from "../catalogErrors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const titles = await searchTitles.execute(request.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ titles });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
