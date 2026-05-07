import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !adminToken) {
    return NextResponse.redirect(new URL("/admin_Login", request.url));
  }

  if (pathname === "/admin_Login" && adminToken) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin_Login", "/admin/:path*"],
};
