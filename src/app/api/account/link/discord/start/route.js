import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserForSession, linkedDiscordId } from "@/lib/account";
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

  if (linkedDiscordId(current)) {
    return NextResponse.redirect(
      dashboardLinkUrl(origin, { linkError: "discord_already_linked" })
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET) {
    return NextResponse.redirect(
      dashboardLinkUrl(origin, { linkError: "discord_not_configured" })
    );
  }

  const state = createOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "identify email",
    redirect_uri: linkCallbackUri(request, "/api/account/link/discord/callback"),
    state,
  });

  const response = NextResponse.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
  setLinkStateCookie(response, state);
  return response;
}
