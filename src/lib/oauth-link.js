import crypto from "crypto";

export const LINK_STATE_COOKIE = "jh10c_oauth_link_state";
export const LINK_STATE_MAX_AGE = 15 * 60;

export function createOAuthState() {
  return crypto.randomBytes(32).toString("hex");
}

export function linkStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LINK_STATE_MAX_AGE,
  };
}

export function setLinkStateCookie(response, state) {
  response.cookies.set(LINK_STATE_COOKIE, state, linkStateCookieOptions());
}

export function clearLinkStateCookie(response) {
  response.cookies.set(LINK_STATE_COOKIE, "", {
    ...linkStateCookieOptions(),
    maxAge: 0,
  });
}

export function hasValidLinkState(request) {
  const expected = request.cookies.get(LINK_STATE_COOKIE)?.value || "";
  const received = new URL(request.url).searchParams.get("state") || "";
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function getRequestOrigin(request) {
  const configured = String(process.env.NEXTAUTH_URL || "").trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to the request origin if NEXTAUTH_URL is malformed.
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (host) {
    const proto =
      forwardedProto?.split(",")[0]?.trim() ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export function linkCallbackUri(request, path) {
  return `${getRequestOrigin(request)}${path}`;
}

export function dashboardLinkUrl(origin, params = {}) {
  const url = new URL("/dashboard", origin);
  url.searchParams.set("tab", "profile");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}
