import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import {
  findUserByEmail,
  findUserForSession,
  linkedGoogleSub,
  normalizeEmail,
} from "@/lib/account";
import {
  clearLinkStateCookie,
  dashboardLinkUrl,
  getRequestOrigin,
  hasValidLinkState,
  linkCallbackUri,
} from "@/lib/oauth-link";
import { sanitizeGoogleAvatarUrl } from "@/lib/google-avatar";

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
    return finish(request, origin, { linkError: "google_link_failed" });
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return finish(request, origin, { linkError: "google_not_configured" });
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: linkCallbackUri(
          request,
          "/api/account/link/google/callback"
        ),
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return finish(request, origin, { linkError: "google_link_failed" });
    }

    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: "no-store",
      }
    );

    if (!profileResponse.ok) {
      return finish(request, origin, { linkError: "google_link_failed" });
    }

    const profile = await profileResponse.json();
    const googleSub = String(profile?.sub || "").trim();
    if (!googleSub) {
      return finish(request, origin, { linkError: "google_link_failed" });
    }

    const alreadyLinked = linkedGoogleSub(current);
    if (alreadyLinked && alreadyLinked !== googleSub) {
      return finish(request, origin, { linkError: "google_already_linked" });
    }

    const emailVerified =
      profile?.email_verified === true || profile?.email_verified === "true";
    const email = emailVerified ? normalizeEmail(profile?.email) : "";
    const googlePicture = sanitizeGoogleAvatarUrl(profile?.picture);

    await connectDB();

    const otherGoogle = await User.findOne({
      _id: { $ne: current._id },
      "authProviders.google.sub": googleSub,
    }).lean();

    if (otherGoogle) {
      return finish(request, origin, {
        linkError: "google_used_by_another_account",
      });
    }

    if (email) {
      const emailOwner = await findUserByEmail(email);
      if (emailOwner && String(emailOwner._id) !== String(current._id)) {
        return finish(request, origin, {
          linkError: "email_used_by_another_account",
        });
      }
    }

    await User.findByIdAndUpdate(current._id, {
      $set: {
        "authProviders.google.sub": googleSub,
        "authProviders.google.email": email,
        ...(email && !current.email ? { email } : {}),
        ...(googlePicture ? { googlePicture } : {}),
        lastGoogleLoginAt: new Date(),
        ...(googlePicture && !current.avatar ? { avatar: googlePicture } : {}),
      },
    });

    return finish(request, origin, { linked: "google" });
  } catch (err) {
    console.error("Google account link failed:", err?.message || err);
    return finish(request, origin, { linkError: "google_link_failed" });
  }
}
