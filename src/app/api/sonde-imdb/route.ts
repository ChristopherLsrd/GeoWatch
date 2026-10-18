// SONDE TEMPORAIRE (retirée à la tâche 2) : IMDb répond-il depuis les serveurs Vercel ?

import { NextResponse } from "next/server";
import { ImdbParentsGuide } from "@/infrastructure/imdb/ImdbParentsGuide";

export const dynamic = "force-dynamic";

const IDS = ["tt0137523", "tt0110912", "tt0468569", "tt1375666", "tt6751668", "tt0211915", "tt15398776", "tt0903747"];

export async function GET() {
  const start = performance.now();
  try {
    const guides = await new ImdbParentsGuide().advisories(IDS);
    return NextResponse.json({ ok: true, ms: Math.round(performance.now() - start), found: guides.size, of: IDS.length, sample: Object.fromEntries(guides) });
  } catch (error) {
    return NextResponse.json({ ok: false, ms: Math.round(performance.now() - start), error: String(error) }, { status: 503 });
  }
}
