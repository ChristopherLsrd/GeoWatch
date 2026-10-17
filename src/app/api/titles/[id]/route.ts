// GET /api/titles/tm92641 → { title: TitleDetails } (synopsis, notes, réalisateurs, acteurs principaux)

import { NextResponse } from "next/server";
import { getTitle } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const title = await getTitle.execute((await params).id);
    if (!title) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ title });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
