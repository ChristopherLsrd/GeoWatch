// GET    /api/history              → { entries: { query, searchedAt }[] } (50 au plus, plus récente d'abord)
// POST   /api/history { query }    → { ok: true } (recherche validée ou résultat ouvert)
// DELETE /api/history              → { ok: true } (vide tout l'historique)

import { NextRequest, NextResponse } from "next/server";
import { searchHistory } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ entries: await searchHistory.list() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (typeof body?.query !== "string") return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  try {
    await searchHistory.record(body.query);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    await searchHistory.clear();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
