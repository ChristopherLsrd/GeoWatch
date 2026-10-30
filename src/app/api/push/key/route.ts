// GET /api/push/key → { publicKey } : clé publique VAPID pour pushManager.subscribe.
// 503 « push_not_configured » si les clés VAPID ne sont pas définies.

import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export function GET() {
  if (!vapidPublicKey) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  return NextResponse.json({ publicKey: vapidPublicKey });
}
