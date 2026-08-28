import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  // Both cookies, not just gl_org — a session missing gl_user can't resolve
  // a Membership (see getCurrentMembership), so it isn't really signed in.
  // Catching that here means the redirect happens at the edge; letting it
  // fall through to (app)/layout.tsx's redirect() instead is correct but
  // was measured taking 1.5-2.3s per request in dev — Next.js rendering a
  // Server Component deep enough to throw a redirect is real work this
  // request doesn't need to pay for.
  const signedIn = req.cookies.has("gl_org") && req.cookies.has("gl_user");
  const isLogin = req.nextUrl.pathname === "/login";
  // Public marketing/education pages — no sign-in required, by design.
  // /understand covers its own sub-pages too (e.g. /understand/scopes).
  const isPublic = isLogin || req.nextUrl.pathname === "/home" || req.nextUrl.pathname.startsWith("/understand");

  if (!signedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (signedIn && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
