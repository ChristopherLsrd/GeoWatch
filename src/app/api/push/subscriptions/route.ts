// GET /api/push/subscriptions → { devices: [{ endpoint, device, createdAt }] }
// POST /api/push/subscriptions { endpoint, keys: { p256dh, auth }, device } → { device }
// DELETE /api/push/subscriptions { endpoint } → { ok: true }

import { NextRequest, NextResponse } from "next/server";
import { pushDevices } from "@/infrastructure/container";
import { apiErrorResponse } from "../../apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ devices: await pushDevices.list() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json({ device: await pushDevices.register(body) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  try {
    await pushDevices.remove(body?.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
