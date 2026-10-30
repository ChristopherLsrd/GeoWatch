// GET /api/preferences → { preferences: { audioLanguage, subtitleLanguage, priceDropThreshold: { amount, percent }, notifications: { atHome, priceDrop } } }
// PUT /api/preferences { audioLanguage?, subtitleLanguage?, priceDropThreshold?, notifications? } → { preferences }
// (null ou "" : pas de langue ; champ absent : inchangé ; seuil de 0 à 100 ; interrupteur absent de notifications : inchangé)

import { NextRequest, NextResponse } from "next/server";
import { userPreferences } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ preferences: await userPreferences.get() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_preferences" }, { status: 400 });
  try {
    return NextResponse.json({ preferences: await userPreferences.update(body) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
