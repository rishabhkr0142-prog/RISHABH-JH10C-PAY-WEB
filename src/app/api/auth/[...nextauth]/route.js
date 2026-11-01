import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

/**
 * Throttle only the login/callback endpoints — session polling and CSRF
 * requests must stay unthrottled or the navbar would break.
 */
function withAuthRateLimit(fn) {
  return async (request, context) => {
    const path = new URL(request.url).pathname;
    const isLoginPath =
      path.includes("/signin") || path.includes("/callback");

    if (isLoginPath) {
      const forwarded = request.headers.get("x-forwarded-for") || "";
      const ip = forwarded.split(",")[0].trim() || "unknown";
      const rl = rateLimit(`auth_login_${ip}`, 20, 60 * 1000);
      if (!rl.success) {
        return NextResponse.json(
          { error: "Too many login attempts. Please wait a minute." },
          { status: 429 }
        );
      }
    }

    return fn(request, context);
  };
}

export const GET = withAuthRateLimit(handler);
export const POST = withAuthRateLimit(handler);
