import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  findUserForSession,
  linkedGoogleSub,
} from "@/lib/account";
import {
  createOAuthState,
  dashboardLinkUrl,
  getRequestOrigin,
  linkCallbackUri,
  setLinkStateCookie,
} from "@/lib/oauth-link";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = getRequestOrigin(request);
  const session = await getSession();
  const current = await findUserForSession(session);

  if (!current) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", "/dashboard?tab=profile");
    return NextResponse.redirect(loginUrl);
  }

  if (linkedGoogleSub(current)) {
    return NextResponse.redirect(
      dashboardLinkUrl(origin, { linkError: "google_already_linked" })
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      dashboardLinkUrl(origin, { linkError: "google_not_configured" })
    );
  }

  const state = createOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: linkCallbackUri(request, "/api/account/link/google/callback"),
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  setLinkStateCookie(response, state);
  return response;
}
