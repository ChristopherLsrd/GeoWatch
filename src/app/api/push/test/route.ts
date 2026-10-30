// POST /api/push/test → { results: [{ device, ok, error }] } : notification de test à tous les appareils.
// Les appareils expirés sont retirés. 503 « push_not_configured » sans clés VAPID.

import { NextResponse } from "next/server";
import { sendTestNotification } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";
// Un appareil à la fois, jusqu'à 10 s chacun : on laisse la marge pour tous les appareils.
export const maxDuration = 60;

export async function POST() {
  try {
    return NextResponse.json({ results: await sendTestNotification.execute() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
