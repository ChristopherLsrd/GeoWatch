// POST /api/share/resolve { title?, text?, url? } → { kind: "title", id } | { kind: "candidates", candidates }
// | { kind: "search", query }, pour la page /partage (menu Partager d'Android).

import { NextRequest, NextResponse } from "next/server";
import { resolveSharedLink } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";
import { withTiming } from "../../withTiming";

export const dynamic = "force-dynamic";

const MAX_FIELD_LENGTH = 2_000;

function field(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : undefined;
}

export const POST = withTiming(async (request: NextRequest) => {
  try {
    const body: Record<string, unknown> = await request.json().catch(() => ({}));
    const resolution = await resolveSharedLink.execute({ title: field(body?.title), text: field(body?.text), url: field(body?.url) });
    return NextResponse.json(resolution);
  } catch (error) {
    return apiErrorResponse(error);
  }
});
