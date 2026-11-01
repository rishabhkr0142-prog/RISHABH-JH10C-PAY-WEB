import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";

/**
 * GET /api/loader
 * Authenticated redirect to the loader download URL.
 * LOADER_URL stays server-side and is never sent to the browser as data.
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be logged in to download the loader." },
      { status: 401 }
    );
  }

  try {
    await connectDB();

    const hasLicense = await Order.exists({
      status: "completed",
      licenseKey: { $exists: true },
      $or: [
        { discordId: session.user.id },
        { userId: session.user.id },
      ],
    });

    if (!hasLicense) {
      return NextResponse.json(
        { error: "No delivered license was found for your account." },
        { status: 403 }
      );
    }

    const loaderUrl = String(process.env.LOADER_URL || "").trim();
    if (!loaderUrl) {
      return NextResponse.json(
        { error: "Loader link is not configured yet." },
        { status: 503 }
      );
    }

    let parsed;
    try {
      parsed = new URL(loaderUrl);
    } catch {
      return NextResponse.json(
        { error: "Loader link is misconfigured." },
        { status: 500 }
      );
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json(
        { error: "Loader link is misconfigured." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(parsed.toString());
  } catch (err) {
    console.error("GET /api/loader failed:", err?.message || err);
    return NextResponse.json(
      { error: "Could not open the loader link." },
      { status: 500 }
    );
  }
}
