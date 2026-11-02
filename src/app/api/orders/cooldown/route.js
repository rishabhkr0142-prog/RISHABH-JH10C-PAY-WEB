import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { findUserForSession } from "@/lib/account";
import { ownerFilterFor } from "@/lib/order-access";
import { isUserAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/cooldown
 * Returns current cooldown status for the logged-in user:
 * {
 *   loggedIn: boolean,
 *   isAdmin: boolean,
 *   inCooldown: boolean,
 *   remainingSeconds: number,
 *   cooldownMinutes: number
 * }
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({
      loggedIn: false,
      isAdmin: false,
      inCooldown: false,
      remainingSeconds: 0,
      cooldownMinutes: 10,
    });
  }

  // Admins are exempt from order cooldown
  if (isUserAdmin(session)) {
    return NextResponse.json({
      loggedIn: true,
      isAdmin: true,
      inCooldown: false,
      remainingSeconds: 0,
      cooldownMinutes: 10,
    });
  }

  try {
    await connectDB();

    const cooldownMinutesSetting = await getSetting(
      "order_cooldown_minutes",
      process.env.ORDER_COOLDOWN_MINUTES || 10
    );
    const cooldownMinutes = Math.max(1, Number(cooldownMinutesSetting) || 10);
    const cooldownMs = cooldownMinutes * 60 * 1000;

    const userDoc = await findUserForSession(session);
    const userDocLean = userDoc?.toObject ? userDoc.toObject() : userDoc;
    const query = ownerFilterFor(session, userDocLean);

    if (!query) {
      return NextResponse.json({
        loggedIn: true,
        isAdmin: false,
        inCooldown: false,
        remainingSeconds: 0,
        cooldownMinutes,
      });
    }

    const latestOrder = await Order.findOne(query)
      .sort({ createdAt: -1 })
      .lean();

    if (!latestOrder) {
      return NextResponse.json({
        loggedIn: true,
        isAdmin: false,
        inCooldown: false,
        remainingSeconds: 0,
        cooldownMinutes,
      });
    }

    const elapsedMs = Date.now() - new Date(latestOrder.createdAt).getTime();

    if (elapsedMs < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return NextResponse.json({
        loggedIn: true,
        isAdmin: false,
        inCooldown: true,
        remainingSeconds,
        cooldownMinutes,
        lastOrderAt: latestOrder.createdAt,
      });
    }

    return NextResponse.json({
      loggedIn: true,
      isAdmin: false,
      inCooldown: false,
      remainingSeconds: 0,
      cooldownMinutes,
    });
  } catch (err) {
    console.error("GET /api/orders/cooldown failed:", err);
    return NextResponse.json({
      loggedIn: true,
      isAdmin: false,
      inCooldown: false,
      remainingSeconds: 0,
      cooldownMinutes: 10,
    });
  }
}

