import Link from "next/link";
import { buildPageMetadata } from "@/lib/site";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.replace(/[\[\]]/g, "") ||
  "support@jh10c.com";

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "Read what account, order, payment, and support data this store collects, why it is used, who processes it, and how to contact support about your data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-28 pt-16 sm:px-8">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-white">Privacy Policy</span>
      </nav>

      <div className="mt-8">
        <span className="badge-theme px-3 py-1 text-xs font-semibold">Legal</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-neutral-500">
          Last updated: 8 November 2026
        </p>
      </div>

      <div className="glass mt-8 space-y-8 p-6 text-sm leading-relaxed text-neutral-300 sm:p-8">
        <section>
          <h2 className="text-base font-bold text-white">Who we are</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            RISHABH JH10C PAY WEB operates this digital products store. This
            policy explains how we handle personal data when you browse the
            store, sign in, place an order, join the reseller program, or contact
            support. It does not cover Discord, Google, WhatsApp, UPI apps, or
            other third-party services, which have their own privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            Data we collect and why
          </h2>

          <div className="mt-4 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Account and sign-in data
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                When you sign in with Discord or Google, we receive and store the
                provider account ID, display name or username, email address if
                the provider shares it, profile image, linked provider identity,
                last Google sign-in time, account role, reseller status, order
                count, total spent, last order time, and your homepage photo
                visibility setting. We use this to create and secure your
                account, link sign-in methods, show your account state, and
                prevent duplicate or abusive accounts.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Order and delivery data
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                When you place an order, we store the order reference, product or
                plan, price, discount, coupon, order status, timestamps, buyer
                name and email snapshot, linked Discord ID, submitted UTR, and
                delivery details such as a license key or delivery content. We
                use this to process payment, deliver your purchase, show your
                order history, provide support, and prevent duplicate or
                fraudulent claims.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Payment data
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                Our payment records can include the 12-digit UPI UTR,
                transaction reference, amount, payer UPI ID if it appears in the
                payment alert, payment time, matching status, and the linked
                order. We use this to match incoming UPI payments to orders. We
                do not receive or store your UPI PIN, bank password, card
                number, or card security code; those are handled by your payment
                or banking app.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Support communications
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                If you contact us through WhatsApp, Discord, email, or the
                support page links, we receive the message, your contact
                details, and any order or payment information you choose to
                share. We use this to answer your question, investigate payment
                or delivery issues, and keep a record of the support request.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Technical and security data
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                Our hosting and database providers may process standard server
                logs, such as IP address, browser type, requested URL, timestamp,
                and error details. We also keep short-lived rate-limit counters
                tied to your account ID. We use this data to keep the store
                online, diagnose errors, prevent spam, and protect orders and
                accounts.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Public profile display
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                Recent account usernames and avatars may appear in the homepage
                community row. If you sign in with Google, your Google profile
                photo may appear in the homepage Google sign-in row. The Google
                row shows only the total count and up to four photos; it does not
                show your name or email. You can turn off your Google photo
                visibility in your dashboard. Contact support if you want a
                public username or avatar removed.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            Cookies and local storage
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            We use essential sign-in cookies so you can stay logged in and
            complete checkout. We store your theme choice in your browser local
            storage under the name <code>jh10c_theme</code>. We do not use
            advertising or retargeting cookies by default. If Google Analytics
            is enabled for this store, it may set analytics cookies; in that
            case you can limit or block them through your browser settings or
            the Google Analytics opt-out browser add-on. Blocking essential
            cookies may prevent sign-in, checkout, or dashboard access.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            Who processes your data
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            We use service providers to run the store, including hosting and
            server logs, database storage, image hosting, Discord sign-in and
            delivery, Google sign-in, Google Analytics if enabled, and UPI
            payment alert processing. These providers process data only for the
            services they supply. We do not sell or rent your personal data. We
            may disclose data when required by law, to respond to valid legal
            requests, to protect the store or users from fraud or abuse, or to
            enforce our terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            How long we keep data
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            We keep account data while your account is active. We keep order,
            payment, and delivery records for as long as needed for accounting,
            tax, fraud prevention, dispute resolution, license support, and legal
            compliance, even if your account is later closed. Support messages
            are kept only as long as needed to resolve the request. Server logs
            and rate-limit counters are kept for short operational periods.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">Security</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The store uses HTTPS, server-side secrets, access controls, and
            OAuth sign-in. Access to account, order, and payment records is
            limited to people and systems that need it to run the store and
            support you. No website or storage system is completely secure, so
            please use a strong, unique password with your Discord or Google
            account and contact support immediately if you suspect unauthorized
            access.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            Your choices and rights
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            You can ask us to access, correct, or delete your personal data, or
            withdraw consent where consent is the basis for processing. You can
            turn off your Google photo visibility in your dashboard at any time.
            To make a request, contact support from the email or Discord account
            linked to your order. We may need to verify your identity before
            acting. Some records may be kept where we have a legal, accounting,
            fraud-prevention, or dispute-resolution need, and deleting your
            account may mean you lose access to order history and license
            delivery.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Depending on where you live, you may also have the right to object to
            certain processing or complain to your local data protection
            authority. We process data to perform our contract with you, with
            your consent where required, and for legitimate interests such as
            securing the store and preventing fraud.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">Children</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The store is not directed to children under 13. If you are under 18,
            use the store only with the involvement of a parent or guardian. If
            we learn that we have collected personal data from a child under 13,
            we will delete it or ask for guardian involvement.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            International processing
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Our service providers may process data in countries other than
            India. Where required, we rely on the providers&apos; safeguards for
            international transfers. The protections described in this policy
            apply to data we control.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">
            Changes to this policy
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            We may update this policy when the store, providers, or legal
            requirements change. The updated date at the top shows the latest
            version. If a change is material, we will post a notice on the store
            or contact you through your account.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white">Contact</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            For privacy questions or requests, contact{" "}
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
            . Include the email or Discord account linked to your order so we
            can find your records.
          </p>
        </section>
      </div>
    </article>
  );
}
