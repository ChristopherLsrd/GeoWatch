import { NextRequest, NextResponse } from "next/server";
import { Login } from "@/application/auth/Login";
import { isAppPassword } from "@/infrastructure/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/mongo/client";
import { MongoLoginAttemptRepository } from "@/infrastructure/mongo/MongoLoginAttemptRepository";

export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const login = new Login(new MongoLoginAttemptRepository(await getDb()), isAppPassword);
  const result = await login.execute(clientIp(request), password);

  if (!result.ok) {
    if (result.reason === "blocked") {
      return NextResponse.json(
        { error: "blocked", retryAfterSeconds: result.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      );
    }
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(process.env.SESSION_SECRET!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}
