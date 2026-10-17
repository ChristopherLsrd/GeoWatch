// DELETE /api/alerts/:id → { ok: true } (masque une nouveauté)

import { NextResponse } from "next/server";
import { alerts } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await alerts.dismiss((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
