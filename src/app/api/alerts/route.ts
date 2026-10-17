// GET    /api/alerts → { alerts: Alert[] } (nouveautés de la liste à voir, plus récentes d'abord)
// DELETE /api/alerts → { ok: true } (masque toutes les nouveautés)

import { NextResponse } from "next/server";
import { alerts } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ alerts: await alerts.list() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    await alerts.dismissAll();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
