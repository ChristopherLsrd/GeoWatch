// GET  /api/watchlist                      → { items: WatchlistOverviewItem[] } (du plus récent au plus ancien,
//                                            avec le résumé de la fiche et le badge « disponible chez moi »)
// POST /api/watchlist { titleId: "tm92641" } → 201 { item } (200 si déjà présent)

import { NextRequest, NextResponse } from "next/server";
import { dailyCheck, watchlist, watchlistOverview } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ items: await watchlistOverview.list() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const titleId = typeof body?.titleId === "string" ? body.titleId : "";
  if (!titleId) return NextResponse.json({ error: "invalid_title" }, { status: 400 });
  try {
    const existed = (await watchlist.get(titleId)) !== null;
    const item = await watchlist.add(titleId);
    // Vérification immédiate pour le badge « disponible chez moi », sans bloquer l'ajout si elle échoue.
    if (!existed) await dailyCheck.checkTitle(item.title).catch((error) => console.error(error));
    return NextResponse.json({ item }, { status: existed ? 200 : 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
