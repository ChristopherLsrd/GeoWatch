// GET    /api/subscriptions                          → { subscriptions: Subscription[] }
// POST   /api/subscriptions { platformId, country }  → 201 { subscription } (404 si plateforme absente du pays)
// DELETE /api/subscriptions?platformId=8&country=FR  → { ok: true }

import { NextRequest, NextResponse } from "next/server";
import { subscriptions } from "@/infrastructure/container";
import { apiErrorResponse } from "../apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ subscriptions: await subscriptions.list() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (typeof body?.platformId !== "string" || typeof body?.country !== "string") {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }
  try {
    const subscription = await subscriptions.add(body.platformId, body.country);
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const platformId = request.nextUrl.searchParams.get("platformId");
  const country = request.nextUrl.searchParams.get("country");
  if (!platformId || !country) return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  try {
    await subscriptions.remove(platformId, country);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
