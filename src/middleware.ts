import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/infrastructure/auth/session";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

// Vercel envoie « Authorization: Bearer <CRON_SECRET> » aux routes du cron.
function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/cron/")) {
    return isAuthorizedCron(request)
      ? NextResponse.next()
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (secret && (await verifySessionToken(token, secret))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tout sauf les fichiers statiques de Next.js, le favicon (icon.svg) et le logo TMDB du pied de page (visible sur la page de connexion).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|tmdb-logo.svg).*)"],
};
