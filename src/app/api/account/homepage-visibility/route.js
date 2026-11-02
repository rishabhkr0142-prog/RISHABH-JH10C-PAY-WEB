import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { findUserForSession } from "@/lib/account";
import User from "@/models/User";
import { GOOGLE_USERS_CACHE_TAG } from "@/lib/google-users";

export const dynamic = "force-dynamic";

async function currentUser() {
  const session = await getSession();
  if (!session?.user) return null;
  return findUserForSession(session);
}

/** GET /api/account/homepage-visibility — current opt-in state (own account only). */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    showOnHomepage: user.showOnHomepage !== false,
  });
}

/** PATCH /api/account/homepage-visibility — toggle own homepage photo visibility. */
export async function PATCH(request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body?.showOnHomepage !== "boolean") {
    return NextResponse.json(
      { error: "showOnHomepage must be a boolean" },
      { status: 400 }
    );
  }

  await User.findByIdAndUpdate(user._id, {
    $set: { showOnHomepage: body.showOnHomepage },
  });

  revalidatePath("/");
  revalidateTag(GOOGLE_USERS_CACHE_TAG);

  return NextResponse.json({
    ok: true,
    showOnHomepage: body.showOnHomepage,
  });
}
