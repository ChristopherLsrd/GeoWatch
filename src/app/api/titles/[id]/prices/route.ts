// GET /api/titles/tm92641/prices
// → { histories: [{ titleId, country, platformId, platformName, monetizationType, points, low, high }] }
// Prix de location et d'achat (France, HD et 4K) relevés par la vérification quotidienne. Vide pour un titre
// jamais suivi ; un titre retiré de la liste garde son historique (jamais supprimé). Points de la devise
// actuelle seulement. Lecture Mongo seule. Réponse avec l'en-tête Server-Timing (mongo, total).

import { NextRequest, NextResponse } from "next/server";
import { titlePrices } from "@/infrastructure/container";
import { apiErrorResponse } from "../../../apiErrors";
import { withTiming } from "../../../withTiming";

export const dynamic = "force-dynamic";

export const GET = withTiming(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    return NextResponse.json({ histories: await titlePrices.forTitle((await params).id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
});
