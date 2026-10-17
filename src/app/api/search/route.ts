// GET /api/search?q=inception → { titles: Title[] }

import { NextRequest, NextResponse } from "next/server";
import { searchTitles } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const titles = await searchTitles.execute(request.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ titles });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
