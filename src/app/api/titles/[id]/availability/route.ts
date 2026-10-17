// GET /api/titles/tm92641/availability?countries=FR,BE,CH
// → { offers: { FR: Offer[], BE: [], … } } (liste vide = vérifié, non disponible)

import { NextRequest, NextResponse } from "next/server";
import { getTitleAvailability } from "@/infrastructure/container";
import { catalogErrorResponse } from "../../../catalogErrors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const countries = (request.nextUrl.searchParams.get("countries") ?? "").split(",").filter(Boolean);
    const offers = await getTitleAvailability.execute((await params).id, countries);
    return NextResponse.json({ offers });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
