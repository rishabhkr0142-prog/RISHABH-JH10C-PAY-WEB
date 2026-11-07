import { getSession } from "@/lib/session";
import { findUserForSession } from "@/lib/account";
import ResellerClient from "./ResellerClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reseller Program",
  description:
    "Join the lifetime Reseller program and unlock 50% OFF on every License App product. One-time ₹149 membership with instant activation after payment.",
};

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
