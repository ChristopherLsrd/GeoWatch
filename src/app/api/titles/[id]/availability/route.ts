// GET /api/titles/tm92641/availability?countries=FR,BE,CH[&refresh=1]
// → { offers: { FR: Offer[], BE: [], … }, checkedAt: { FR: "2026-10-17T08:12:00.000Z", … } }
// Liste vide = vérifié, non disponible. refresh=1 ignore le cache du jour.

import { NextRequest, NextResponse } from "next/server";
import { getTitleAvailability } from "@/infrastructure/container";
import { catalogErrorResponse } from "../../../catalogErrors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const search = request.nextUrl.searchParams;
    const countries = (search.get("countries") ?? "").split(",").filter(Boolean);
    const availabilities = await getTitleAvailability.execute((await params).id, countries, {
      refresh: search.get("refresh") === "1",
    });
    const entries = Object.values(availabilities);
    return NextResponse.json({
      offers: Object.fromEntries(entries.map((a) => [a.country, a.offers])),
      checkedAt: Object.fromEntries(entries.map((a) => [a.country, a.fetchedAt.toISOString()])),
    });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
