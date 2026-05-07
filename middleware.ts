import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin/");

  if (isAdminRoute && !adminToken) {
    return NextResponse.redirect(new URL("/admin_Login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin_Login", "/admin/:path*"],
};
