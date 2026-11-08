import Link from "next/link";
import { buildPageMetadata } from "@/lib/site";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.replace(/[\[\]]/g, "") ||
  "support@jh10c.com";

export const metadata = buildPageMetadata({
  title: "Terms & Conditions",
  description:
    "Read the terms for using the store, placing orders, UPI payments, digital delivery, replacements, and the reseller membership.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-28 pt-16 sm:px-8">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-white">Terms &amp; Conditions</span>
      </nav>

      <div className="mt-8">
        <span className="badge-theme px-3 py-1 text-xs font-semibold">Legal</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Terms &amp; Conditions
        </h1>
        <p className="mt-2 text-xs text-neutral-500">
          Last updated: 8 November 2026
        </p>
      </div>

      <div className="glass mt-8 space-y-8 p-6 text-sm leading-relaxed text-neutral-300 sm:p-8">
        <section>
          <h2 className="text-base font-bold text-white">1. Agreement</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            These terms apply when you use RISHABH JH10C PAY WEB, sign in, place
            an order, join the reseller program, or contact support. By using the
            store, you agree to these terms and our{" "}
            <Link href="/privacy" className="font-semibold text-white underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/refund" className="font-semibold text-white underline">
              Refund Policy
            </Link>
            . If you do not agree, do not use the store.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            2. Store and eligibility
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The store sells digital products and license-based access. You must
            be able to enter a binding contract where you live. If you are under
            18, use the store only with the involvement of a parent or guardian.
            You are responsible for making sure the products you buy are suitable
            for your device, account, and intended use.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            3. Accounts and sign-in
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Sign-in is provided through Discord or Google OAuth. You are
            responsible for keeping your provider account secure and for activity
            made through your store account. We may link a verified email or
            provider identity to an existing account to prevent duplicate
            accounts. Do not create accounts to evade limits, bans, or payment
            checks.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            4. Products and licenses
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Product descriptions, features, plans, and availability are shown on
            the product page. Digital products are provided under the license or
            access terms stated for that product. Unless the product page or an
            active reseller arrangement says otherwise, a license key is for the
            buyer and may not be shared, published, or resold outside the
            store&apos;s reseller program. We do not sell ownership of
            third-party software or brands.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            5. Orders, pricing, and availability
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Orders are created in pending status and remain payable for about 15
            minutes. Prices are shown in Indian Rupees (INR) and include the
            discount that applies at checkout. Where inventory is limited, a unit
            is reserved while the order is pending. If stock cannot be reserved
            or the product becomes unavailable, the order or payment may require
            admin review and support will help resolve it. We may change products,
            plans, prices, stock, and offers at any time before an order is
            completed.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            6. UPI payments and UTR verification
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Checkout currently collects payment by UPI. After paying, you submit
            the 12-digit UPI UTR or transaction reference. We match the UTR to an
            incoming payment for the exact order amount and time window. One UTR
            can match only one order. A payment that is not found yet may still
            be in transit, so wait up to 30 to 60 seconds and retry. If the amount,
            time window, or order reference does not match, the payment will not
            be accepted automatically. Do not submit a UTR that belongs to another
            order, a fake reference, or a payment you did not make. Fake,
            duplicate, manipulated, or stolen payment references may result in
            cancelled orders, revoked access, or an account ban.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">7. Delivery</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Digital delivery starts after payment is verified. Delivery may
            appear in your dashboard, on the order page, and through a Discord
            direct message when your Discord account is linked. Delivery is
            automatic where possible, but some orders may need manual review.
            Keep your order reference and check your dashboard before contacting
            support. Do not share license keys or private delivery content
            publicly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            8. Coupons and reseller discount
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Coupons and offers are valid only for the stated products, dates, and
            conditions. Reseller and coupon discounts do not stack; the larger
            discount applies, and the reseller discount wins a tie. Reseller
            discount applies only to License App (auth panel) products. We may
            correct pricing or discount errors before delivery.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            9. Reseller membership
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The reseller membership is a one-time ₹149 fee for a lifetime
            membership on one account. It gives 50% off License App (auth panel)
            products, including future products that are marked as License App
            products. It does not discount other products and does not stack with
            coupons or offers. Membership activates only after the payment is
            verified. The fee is non-refundable once the membership is activated,
            and the membership is non-transferable. We may revoke membership
            without refund for abuse, fraud, chargebacks, payment manipulation,
            or violation of these terms. We may change the discount or program
            terms for future purchases; changes will be shown on the reseller
            page.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            10. Refunds and replacements
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Digital products cannot be refunded once delivered, except where the{" "}
            <Link href="/refund" className="font-semibold text-white underline">
              Refund Policy
            </Link>{" "}
            says otherwise. If a license or delivery is defective, not working as
            described, or not delivered, contact support with your order
            reference, UTR, and a clear description of the issue. We will
            investigate and provide a replacement, or a refund where a
            replacement cannot be provided. Nothing in these terms limits
            mandatory rights you may have under applicable consumer law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">11. Acceptable use</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            You must not use the store to commit fraud, submit fake or duplicate
            payment references, abuse coupons or the reseller program, spam
            checkout or support, attempt unauthorized access, interfere with the
            store or its providers, share private delivery content, or violate
            applicable law. You must not use automated tools to create orders,
            claim payments, or scrape private account or order data.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            12. Intellectual property
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The store design, branding, text, and original content belong to the
            store or its licensors. Product names, logos, and software belong to
            their respective owners. Your purchase gives you the license or access
            described on the product page; it does not transfer ownership of the
            store or third-party products.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            13. Third-party services
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The store relies on third-party services for sign-in, hosting,
            database storage, payments, image hosting, and Discord delivery. We
            are not responsible for outages, policy changes, or actions of those
            providers, but we will try to help resolve delivery issues caused by
            an outage. Your use of Discord, Google, UPI apps, and other services
            is also subject to their own terms and policies.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            14. Disclaimers and liability
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The store is provided on an &quot;as available&quot; basis. We do not
            guarantee uninterrupted access, error-free operation, or that every
            third-party product will work on every device or account. To the
            maximum extent permitted by law, we are not liable for indirect,
            incidental, special, or consequential losses, and our total liability
            for an order will not exceed the amount you paid for that order.
            Nothing in these terms excludes liability that cannot be excluded by
            law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            15. Suspension and termination
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            We may suspend or terminate an account, cancel an order, revoke a
            reseller membership, or restrict access if we reasonably believe you
            have violated these terms, committed fraud, abused the store, or
            created a risk for other users or the store. Where a refund is
            required by law or our Refund Policy, we will process it; otherwise
            revoked access or memberships are not refunded.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">16. Changes</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            We may update these terms when the store, providers, or legal
            requirements change. The updated date at the top shows the current
            version. Changes apply to future use and orders. If a change is
            material, we will post a notice on the store or contact you through
            your account.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            17. Governing law and contact
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            These terms are governed by the laws that apply where the store
            operator is established, without limiting mandatory consumer rights
            you may have. Disputes will be handled by a court with jurisdiction
            over the store operator, unless applicable law gives you another
            forum. For questions about these terms, contact{" "}
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
            .
          </p>
        </section>
      </div>
    </article>
  );
}
