import { getSession } from "@/lib/session";
import { findUserForSession } from "@/lib/account";
import ResellerClient from "./ResellerClient";
import { buildPageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Reseller Program — 50% OFF",
  description:
    "Join the lifetime Reseller program for 50% OFF license products. One-time ₹149 membership activates after UPI payment verification.",
  path: "/reseller",
});

export default async function ResellerPage() {
  const session = await getSession();

  let loggedIn = false;
  let isReseller = false;
  let resellerSince = null;

  if (session?.user?.id) {
    loggedIn = true;
    try {
      const user = await findUserForSession(session);
      isReseller = Boolean(user?.isReseller);
      resellerSince = user?.resellerSince
        ? new Date(user.resellerSince).toISOString()
        : null;
    } catch (err) {
      console.error("Reseller page user lookup failed:", err?.message || err);
    }
  }

  return (
    <ResellerClient
      loggedIn={loggedIn}
      initialIsReseller={isReseller}
      resellerSince={resellerSince}
    />
  );
}
