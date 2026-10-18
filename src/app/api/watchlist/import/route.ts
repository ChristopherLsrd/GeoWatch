// POST /api/watchlist/import { entries: LetterboxdEntry[] }           → { results, remaining } (MAX_BATCH films au plus)
// POST /api/watchlist/import { resolve: { titleId, addedAt } }        → 201 { item } (candidat choisi par l'utilisateur)
// Si JustWatch refuse en cours de lot, la réponse reste 200 : `remaining` contient les films non traités.

import { NextRequest, NextResponse } from "next/server";
import { MAX_BATCH } from "@/application/import/ImportLetterboxd";
import { MAX_NAME_LENGTH, type LetterboxdEntry } from "@/application/import/parseLetterboxdCsv";
import { importLetterboxd } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";
// 5 films × (recherche + fiche + pause de 1 s) : largement moins d'une minute.
export const maxDuration = 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" && DATE.test(value) ? value : undefined;
}

function parseEntry(value: unknown): LetterboxdEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, year, addedAt, letterboxdUri } = value as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LENGTH) return null;
  if (year !== null && !(Number.isInteger(year) && (year as number) > 1800 && (year as number) < 3000)) return null;
  const date = parseDate(addedAt);
  if (date === undefined) return null;
  const uri = typeof letterboxdUri === "string" && letterboxdUri.startsWith("https://") ? letterboxdUri : null;
  return { name: name.trim(), year: year as number | null, addedAt: date, letterboxdUri: uri };
}

const invalid = () => NextResponse.json({ error: "invalid_import" }, { status: 400 });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  try {
    if (body?.resolve) {
      const titleId = typeof body.resolve.titleId === "string" ? body.resolve.titleId : "";
      const addedAt = parseDate(body.resolve.addedAt);
      if (!titleId || addedAt === undefined) return invalid();
      return NextResponse.json({ item: await importLetterboxd.resolve(titleId, addedAt) }, { status: 201 });
    }
    if (!Array.isArray(body?.entries) || body.entries.length === 0 || body.entries.length > MAX_BATCH) return invalid();
    const entries = body.entries.map(parseEntry);
    if (entries.some((e: LetterboxdEntry | null) => e === null)) return invalid();
    return NextResponse.json(await importLetterboxd.importEntries(entries as LetterboxdEntry[]));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
