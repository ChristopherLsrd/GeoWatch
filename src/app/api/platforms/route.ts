// GET /api/platforms?country=FR → { platforms: Platform[] } (plateformes d'abonnement du pays, triées par nom)

import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SUBSCRIPTION_COUNTRY } from "@/domain/Subscription";
import { subscriptions } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const country = request.nextUrl.searchParams.get("country") ?? DEFAULT_SUBSCRIPTION_COUNTRY;
    return NextResponse.json({ platforms: await subscriptions.availablePlatforms(country) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
