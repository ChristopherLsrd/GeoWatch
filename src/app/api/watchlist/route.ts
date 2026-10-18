// GET  /api/watchlist                      → { items: WatchlistOverviewItem[], pending } (du plus récent au plus ancien,
//                                            avec le résumé de la fiche et le badge « disponible chez moi » ;
//                                            pending : titres à compléter par POST /api/watchlist/check)
// POST /api/watchlist { titleId: "tm92641" } → 201 { item } (200 si déjà présent)
// Réponse avec l'en-tête Server-Timing (mongo, justwatch, total).

import { NextRequest, NextResponse } from "next/server";
import { dailyCheck, watchlist, watchlistOverview } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";
import { withTiming } from "../withTiming";

export const dynamic = "force-dynamic";

export const GET = withTiming(async () => {
  try {
    return NextResponse.json(await watchlistOverview.list());
  } catch (error) {
    return apiErrorResponse(error);
  }
});

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
