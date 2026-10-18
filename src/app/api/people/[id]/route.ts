// GET /api/people/tp1725 → { person, filmography: { DIRECTOR, ACTOR, OTHER } } (cartes avec le badge « Chez moi »)
// 404 si la personne est inconnue. Réponse avec l'en-tête Server-Timing (mongo, justwatch, total).

import { NextResponse } from "next/server";
import { getPerson } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";
import { withTiming } from "../../withTiming";

export const dynamic = "force-dynamic";

export const GET = withTiming(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const page = await getPerson.execute((await params).id);
    if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(page);
  } catch (error) {
    return apiErrorResponse(error);
  }
});
