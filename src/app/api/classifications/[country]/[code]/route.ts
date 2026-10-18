// GET /api/classifications/FR/12?type=MOVIE&violence=severe… → { titles, total, nextCursor, homeAvailable }
// 404 si la classification est inconnue ; 503 si JustWatch, ou IMDb avec un filtre sur les raisons, est indisponible.
// Réponse avec l'en-tête Server-Timing (mongo, justwatch, imdb, total).

import { listRatedTitles } from "@/infrastructure/container";
import { handleRatingRequest } from "../../handleRatingRequest";
import { withTiming } from "../../../withTiming";

export const dynamic = "force-dynamic";

export const GET = withTiming(async (request: Request, { params }: { params: Promise<{ country: string; code: string }> }) => {
  const { country, code } = await params;
  return handleRatingRequest(listRatedTitles, decodeURIComponent(country), decodeURIComponent(code), new URL(request.url).searchParams);
});
