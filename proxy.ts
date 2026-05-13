import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/api/role-types", "/api/jobs", "/api/ai"];

export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) return NextResponse.next();
  if (req.auth) return NextResponse.next();

  // For API routes, return 401 JSON; for pages, redirect to /signin.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const signInUrl = new URL("/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Skip Next.js internals and static files; auth.js handlers stay accessible.
  matcher: ["/((?!_next|api/auth|favicon.ico|.*\\..*).*)"],
};
