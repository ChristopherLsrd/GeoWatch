// Réponse de GET /api/classifications/{pays}/{code}, séparée de la route pour être testée sans le conteneur.

import { NextResponse } from "next/server";
import type { ListRatedTitles } from "@/application/ratings/ListRatedTitles";
import { isRatingListKnown, parseRatingParams } from "@/application/ratings/ratingParams";
import { apiErrorResponse } from "../apiErrors";

export async function handleRatingRequest(
  useCase: ListRatedTitles,
  country: string,
  code: string,
  params: URLSearchParams,
): Promise<NextResponse> {
  if (!isRatingListKnown(country, code)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { filters, after } = parseRatingParams(params);
  const { advisory, ...query } = filters;
  try {
    return NextResponse.json(await useCase.execute({ ...query, country, code, after }, advisory));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
