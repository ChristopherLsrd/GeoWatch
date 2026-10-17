// Test de faisabilité : vérifier que JustWatch répond depuis les serveurs Vercel.
// GET /api/faisabilite?titre=Inception&pays=FR,BE,CH,CA,US

import { NextRequest, NextResponse } from "next/server";
import { JustWatchError, offersForCountries, searchTitles } from "@/infrastructure/justwatch/justwatchClient";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const titre = params.get("titre") ?? "Inception";
  const pays = (params.get("pays") ?? "FR,BE,CH,LU,CA,US").split(",").slice(0, 20);
  const debut = Date.now();

  try {
    const resultats = await searchTitles(titre, "FR", "fr");
    const premier = resultats[0];
    if (!premier) {
      return NextResponse.json({ ok: true, titre, message: "Aucun résultat", dureeMs: Date.now() - debut });
    }

    const offres = await offersForCountries(premier.id, pays, "fr");
    const resume = Object.fromEntries(
      Object.entries(offres).map(([code, liste]) => [
        code,
        liste.map((o) => ({
          plateforme: o.package.clearName,
          type: o.monetizationType,
          qualite: o.presentationType,
          prix: o.retailPrice,
          audio: o.audioLanguages?.length ? o.audioLanguages : "non renseigné",
          sousTitres: o.subtitleLanguages?.length ? o.subtitleLanguages : "non renseigné",
        })),
      ]),
    );

    return NextResponse.json({
      ok: true,
      dureeMs: Date.now() - debut,
      region: process.env.VERCEL_REGION ?? "local",
      titre: {
        id: premier.id,
        type: premier.objectType,
        nom: premier.content.title,
        annee: premier.content.originalReleaseYear,
        imdb: premier.content.externalIds?.imdbId,
        tmdb: premier.content.externalIds?.tmdbId,
      },
      autresResultats: resultats.slice(1).map((r) => `${r.content.title} (${r.content.originalReleaseYear})`),
      offres: resume,
    });
  } catch (erreur) {
    const e = erreur instanceof JustWatchError ? erreur : null;
    return NextResponse.json(
      {
        ok: false,
        dureeMs: Date.now() - debut,
        region: process.env.VERCEL_REGION ?? "local",
        erreur: erreur instanceof Error ? erreur.message : String(erreur),
        statutJustWatch: e?.status,
        corps: e?.body,
      },
      { status: 502 },
    );
  }
}
