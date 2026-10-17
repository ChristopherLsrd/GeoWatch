import { NextResponse } from "next/server";
import { InvalidCountriesError } from "@/application/catalog/GetTitleAvailability";
import { InvalidNoteError, NotInWatchlistError, TitleNotFoundError } from "@/application/watchlist/Watchlist";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";

// Traduit les erreurs des cas d'usage en réponses HTTP.
// 503 « catalog_unavailable » : le client arrête les lots et propose « Réessayer ».
export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof CatalogUnavailableError) {
    return NextResponse.json({ error: "catalog_unavailable", message: error.message }, { status: 503 });
  }
  if (error instanceof InvalidCountriesError) {
    return NextResponse.json({ error: "invalid_countries", message: error.message }, { status: 400 });
  }
  if (error instanceof InvalidNoteError) {
    return NextResponse.json({ error: "invalid_note", message: error.message }, { status: 400 });
  }
  if (error instanceof TitleNotFoundError || error instanceof NotInWatchlistError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  console.error(error);
  return NextResponse.json({ error: "internal" }, { status: 500 });
}
