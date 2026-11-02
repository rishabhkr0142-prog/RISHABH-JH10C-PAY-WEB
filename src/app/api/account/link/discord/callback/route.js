import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import {
  findUserForSession,
  linkedDiscordId,
  normalizeEmail,
} from "@/lib/account";
import {
  clearLinkStateCookie,
  dashboardLinkUrl,
  getRequestOrigin,
  hasValidLinkState,
  linkCallbackUri,
} from "@/lib/oauth-link";

export const dynamic = "force-dynamic";

function finish(request, origin, params) {
  const response = NextResponse.redirect(dashboardLinkUrl(origin, params));
  clearLinkStateCookie(response);
  return response;
}

export async function GET(request) {
  const origin = getRequestOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code || !hasValidLinkState(request)) {
    return finish(request, origin, { linkError: "discord_link_failed" });
  }

  const session = await getSession();
  const current = await findUserForSession(session);

  if (!current) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", "/dashboard?tab=profile");
    const response = NextResponse.redirect(loginUrl);
    clearLinkStateCookie(response);
    return response;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return finish(request, origin, { linkError: "discord_not_configured" });
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: linkCallbackUri(
          request,
          "/api/account/link/discord/callback"
        ),
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return finish(request, origin, { linkError: "discord_link_failed" });
    }

    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      return finish(request, origin, { linkError: "discord_link_failed" });
    }

    const profile = await profileResponse.json();
    const discordId = String(profile?.id || "").trim();
    if (!/^\d{15,25}$/.test(discordId)) {
      return finish(request, origin, { linkError: "discord_link_failed" });
    }

    const alreadyLinked = linkedDiscordId(current);
    if (alreadyLinked && alreadyLinked !== discordId) {
      return finish(request, origin, { linkError: "discord_already_linked" });
    }

    await connectDB();
    const other = await User.findOne({
      _id: { $ne: current._id },
      $or: [
        { discordId },
        { "authProviders.discord.id": discordId },
      ],
    }).lean();

    if (other) {
      return finish(request, origin, {
        linkError: "discord_used_by_another_account",
      });
    }

    const verifiedEmail = profile?.verified
      ? normalizeEmail(profile?.email)
      : "";
    const avatarHash = String(profile?.avatar || "");
    const avatarExt = avatarHash.startsWith("a_") ? "gif" : "png";

    await User.findByIdAndUpdate(current._id, {
      $set: {
        discordId,
        "authProviders.discord.id": discordId,
        ...(profile?.username ? { username: String(profile.username) } : {}),
        ...(avatarHash
          ? {
              avatar: `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${avatarExt}`,
            }
          : {}),
        ...(verifiedEmail && !current.email ? { email: verifiedEmail } : {}),
      },
    });

    return finish(request, origin, { linked: "discord" });
  } catch (err) {
    console.error(
      "Discord account link failed:",
      err?.message || err
    );
    return finish(request, origin, { linkError: "discord_link_failed" });
  }
}
