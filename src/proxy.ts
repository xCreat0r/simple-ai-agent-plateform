import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/signup", "/api/auth", "/api/health"];

const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = pathname === "/" || publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const sessionToken = request.cookies.get("better-auth.session_token")?.value;
  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/") && !CSRF_SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host) {
      return NextResponse.json({ error: "请求无效" }, { status: 403 });
    }
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host && !originHost.endsWith(`.${host}`)) {
        return NextResponse.json({ error: "CSRF 校验失败" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "请求无效" }, { status: 403 });
    }
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
