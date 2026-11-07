import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { createResellerOrder } from "@/lib/reseller-order";

export const dynamic = "force-dynamic";

/**
 * POST /api/reseller/join — create (or reuse) the ₹149 lifetime membership
 * order. The membership is activated only after the payment is verified.
 */
export async function POST(request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to join the Reseller program." },
      { status: 401 }
    );
  }

  const rl = rateLimit(`reseller_join_${session.user.id}`, 8, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const idempotencyKey = String(
    request.headers.get("idempotency-key") || ""
  ).trim();

  const result = await createResellerOrder({
    session,
    idempotencyKey,
    endpoint: "POST /api/reseller/join",
  });

  if (result.status < 400) {
    revalidatePath("/reseller");
    revalidatePath("/dashboard");
    revalidatePath("/admin/resellers");
    revalidatePath("/admin");
  }

  return NextResponse.json(result.body, { status: result.status });
}
