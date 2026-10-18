// POST /api/watchlist/check → { items, pending, checked, completed }
// Complète la fiche et vérifie le badge « disponible chez moi » de 3 titres au plus (du plus récent au plus ancien).
// 503 catalog_unavailable si JustWatch est indisponible avant le premier titre.
// Réponse avec l'en-tête Server-Timing (mongo, justwatch, total).

import { NextResponse } from "next/server";
import { watchlistCheck } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";
import { withTiming } from "../../withTiming";

export const dynamic = "force-dynamic";

export const POST = withTiming(async () => {
  try {
    return NextResponse.json(await watchlistCheck.run());
  } catch (error) {
    return apiErrorResponse(error);
  }
});
