import { NextResponse } from "next/server";
import { POST as verifyUtrPost } from "../verify-utr/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:orderId/utr
 * Legacy alias for /verify-utr.
 */
export async function POST(request, context) {
  return verifyUtrPost(request, context);
}
