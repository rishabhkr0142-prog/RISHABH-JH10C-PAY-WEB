import Link from "next/link";
import { buildPageMetadata } from "@/lib/site";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.replace(/[\[\]]/g, "") ||
  "support@jh10c.com";

export const metadata = buildPageMetadata({
  title: "Thank You",
  description:
    "Your request was received. Track your order, access your dashboard, or contact support for help.",
  path: "/thank-you",
  robots: { index: false, follow: false },
});

export default function ThankYouPage({ searchParams }) {
  const rawOrder = Array.isArray(searchParams?.order)
    ? searchParams.order[0]
    : searchParams?.order;
  const orderId = /^[a-f\d]{24}$/i.test(String(rawOrder || ""))
    ? String(rawOrder)
    : "";
  const rawType = Array.isArray(searchParams?.type)
    ? searchParams.type[0]
    : searchParams?.type;
  const isReseller = rawType === "reseller";

  return (
    <article className="mx-auto max-w-3xl px-4 pb-28 pt-16 sm:px-8">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-white">Thank You</span>
      </nav>

      <div className="mt-8 text-center">
        <span className="badge-theme px-3 py-1 text-xs font-semibold">
          Request received
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Thank You
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          {isReseller
            ? "Your reseller checkout request was received. Your membership activates after the UPI payment is verified."
            : "Your request was received. If you just submitted a payment, verification usually finishes within 30 to 60 seconds."}
        </p>
      </div>

      <div className="glass mt-10 p-6 sm:p-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
          What happens next
        </h2>

        <ol className="mt-6 space-y-5">
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 font-mono text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                Keep this order reference
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                {orderId
                  ? `Your order reference ends in ${orderId.slice(-8)}. Use it when contacting support.`
                  : "Use your order number or checkout link when contacting support."}
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 font-mono text-xs font-bold text-white">
              2
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                Wait for payment verification
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                We match your UPI UTR against the incoming payment. If the
                verification is still pending, wait a minute and try again from
                the checkout page.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 font-mono text-xs font-bold text-white">
              3
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                Access delivery in your dashboard
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                License keys and delivery content appear in your dashboard after
                payment is verified. Discord delivery is also attempted when
                your Discord account is linked.
              </p>
            </div>
          </li>
        </ol>

        <div className="mt-8 flex flex-col gap-2.5 border-t border-white/10 pt-6 sm:flex-row">
          {orderId ? (
            <Link
              href={`/checkout/${orderId}`}
              className="btn-primary flex-1 py-3 text-center text-xs font-bold"
            >
              View Order Status
            </Link>
          ) : null}
          <Link
            href={isReseller ? "/reseller" : "/dashboard?tab=orders"}
            className="btn-primary flex-1 py-3 text-center text-xs font-bold"
          >
            {isReseller ? "View Reseller Status" : "Go to Dashboard"}
          </Link>
          <Link
            href="/products"
            className="btn-ghost flex-1 py-3 text-center text-xs font-semibold"
          >
            Browse Products
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-5 text-xs leading-relaxed text-neutral-400">
        <p className="font-semibold text-white">Need help?</p>
        <p className="mt-1.5">
          Contact{" "}
          <Link href="/support" className="font-semibold text-white underline">
            Support
          </Link>{" "}
          or email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-white underline"
          >
            {SUPPORT_EMAIL}
          </a>
          . Include your order reference and a screenshot of the payment if
          possible.
        </p>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-neutral-500">
        This confirmation page does not verify a payment by itself. Order and
        payment status is always shown from the live checkout and dashboard.
      </p>
    </article>
  );
}
