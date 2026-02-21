// Next.js Middleware — CSRF protection + Supabase auth session refresh
//
// Validates Origin header on mutating requests (POST, PUT, PATCH, DELETE) to
// /api/* routes. Blocks cross-origin requests that don't match the app's host.
// Allows: same-origin requests, Vercel cron jobs, and requests without Origin
// (server-to-server, curl, Postman — these are not browser-initiated CSRF).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isAllowedOrigin(requestUrl: URL, originHeader: string | null): boolean {
  // No Origin header: non-browser client (curl, server-to-server, Postman)
  // These are NOT CSRF attacks — browsers always send Origin on cross-site requests
  if (!originHeader) return true;

  try {
    const origin = new URL(originHeader);
    // Same host = same origin (covers http://localhost:3000 and production)
    return origin.host === requestUrl.host;
  } catch {
    // Malformed Origin header → block
    return false;
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  const { pathname, method } = { pathname: request.nextUrl.pathname, method: request.method };

  // Only check CSRF on mutating API requests
  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(method)) {
    const origin = request.headers.get("origin");

    if (!isAllowedOrigin(request.nextUrl, origin)) {
      return NextResponse.json(
        { error: "Forbidden: cross-origin request blocked" },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
