// GET /api/classifications/genres → { genres: [{ code, label }] }, pour le filtre de la page d'une classification.

import { NextResponse } from "next/server";
import { ratingCatalog } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";
import { withTiming } from "../../withTiming";

export const dynamic = "force-dynamic";

export const GET = withTiming(async () => {
  try {
    return NextResponse.json({ genres: await ratingCatalog.genres() });
  } catch (error) {
    return apiErrorResponse(error);
  }
});
