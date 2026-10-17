// GET    /api/watchlist/tm92641                 → { item: WatchlistItem | null }
// PATCH  /api/watchlist/tm92641 { note: "..." } → { ok: true } (404 si absent, 400 si note trop longue)
// DELETE /api/watchlist/tm92641                 → { ok: true }

import { NextRequest, NextResponse } from "next/server";
import { watchlist } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ titleId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    return NextResponse.json({ item: await watchlist.get((await params).titleId) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const body = await request.json().catch(() => null);
  if (typeof body?.note !== "string") return NextResponse.json({ error: "invalid_note" }, { status: 400 });
  try {
    await watchlist.updateNote((await params).titleId, body.note);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await watchlist.remove((await params).titleId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
