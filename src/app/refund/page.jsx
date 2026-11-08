import Link from "next/link";
import { buildPageMetadata } from "@/lib/site";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.replace(/[\[\]]/g, "") ||
  "support@jh10c.com";

export const metadata = buildPageMetadata({
  title: "Refund Policy",
  description:
    "Read the refund and replacement rules for digital products, failed delivery, duplicate UPI payments, and the non-refundable reseller membership.",
  path: "/refund",
});

export default function RefundPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-28 pt-16 sm:px-8">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-white">Refund Policy</span>
      </nav>

      <div className="mt-8">
        <span className="badge-theme px-3 py-1 text-xs font-semibold">Legal</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Refund Policy
        </h1>
        <p className="mt-2 text-xs text-neutral-500">
          Last updated: 8 November 2026
        </p>
      </div>

      <div className="glass mt-8 space-y-8 p-6 text-sm leading-relaxed text-neutral-300 sm:p-8">
        <section>
          <h2 className="text-base font-bold text-white">1. Scope</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            This policy explains when a refund or replacement is available for
            digital products and the reseller membership bought from RISHABH
            JH10C PAY WEB. It should be read with our{" "}
            <Link href="/terms" className="font-semibold text-white underline">
              Terms &amp; Conditions
            </Link>
            . Nothing in this policy limits mandatory rights you may have under
            applicable consumer law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            2. Delivered digital products
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Digital products cannot be refunded once delivered, because delivery
            cannot be returned or undone. This includes license keys, access
            credentials, and private delivery content. Please read the product
            page, plan details, compatibility information, and features before
            buying.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            3. Payment taken but nothing delivered
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            If your payment is verified but delivery does not appear, contact
            support with your order reference, UTR, and a screenshot of the
            payment. We will check the order and delivery logs. If the order
            cannot be delivered, we will deliver it manually, provide an
            equivalent replacement, or refund the amount paid for that order.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            4. Defective or not as described
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            If a license or delivery is defective, does not work as described on
            the product page, or is not the product you ordered, contact support
            with your order reference and a clear description or screenshot of
            the issue. We will investigate and provide a replacement. If a
            replacement cannot be provided, we will refund the amount paid for
            that order. Replacement or refund does not apply where the issue is
            caused by your device, account, network, misuse, or a third-party
            service outside the product description.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            5. Duplicate or incorrect payment
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            If you accidentally pay twice for the same order, or pay the wrong
            amount, contact support before submitting a UTR for the wrong order.
            After verification, a duplicate payment will be refunded. A payment
            that does not match an order amount or time window will not be
            accepted automatically and may require manual review.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            6. Reseller membership
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The one-time ₹149 reseller membership fee is non-refundable once the
            membership is activated. If payment is taken but activation fails,
            contact support so we can fix the activation or refund the payment.
            The membership is non-transferable and may be revoked without refund
            for abuse, fraud, chargebacks, payment manipulation, or violation of
            the reseller terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            7. When a refund is not available
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Refunds are not available for change of mind, accidental purchase,
            ordering the wrong product, failing to read the product details,
            sharing a license key, or losses caused by a third-party service
            after a working product has been delivered. We may also decline a
            refund where there is evidence of fraud, abuse, a fake or duplicate
            UTR, or a chargeback.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            8. How to request help
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
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
            </a>{" "}
            with your order reference, UTR, payment screenshot, and a description
            of the issue. Use the same email or Discord account linked to the
            order where possible. We may ask for more information to verify the
            order before approving a replacement or refund.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            9. Processing and chargebacks
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Approved refunds are sent to the original UPI payment method where
            possible. Processing time depends on your bank and UPI provider, so
            we cannot guarantee a fixed settlement date. Please contact support
            before starting a chargeback or payment dispute so we can investigate
            first. A chargeback or fraudulent dispute may result in suspension of
            your account or reseller membership while the dispute is reviewed.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">10. Changes</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            We may update this policy when the store or legal requirements
            change. The updated date at the top shows the current version. The
            policy that applied when you placed your order will generally apply to
            that order, unless a change is required by law.
          </p>
        </section>
      </div>
    </article>
  );
}
