"use client";

import { DiscordIcon } from "@/components/Navbar";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.replace(/[\[\]]/g, "") || "support@jh10c.com";
const DISCORD_URL =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/tvw2zFMyzA";

const FAQS = [
  {
    q: "How fast is delivery after I place an order?",
    a: "Orders are fulfilled automatically through our Discord bot queue within 2 to 10 minutes. If manual review is required, you will receive a notification in Discord.",
  },
  {
    q: "Which payment methods are accepted?",
    a: "We accept digital gateway payments and manual methods (UPI, PayPal, Crypto, Cards) coordinated securely via our Discord support desk.",
  },
  {
    q: "What if my product or key is defective?",
    a: "Every transaction comes with a full replacement warranty. Reach out to our 24/7 Discord support team with your Order ID for an immediate replacement or refund.",
  },
  {
    q: "Can I place bulk orders or become a reseller?",
    a: "Yes. Reseller tiers and volume discounts are available. Open a partner ticket in our Discord server to receive wholesale pricing.",
  },
  {
    q: "How does the 10-minute order cooldown work?",
    a: "To prevent spam and queue flooding, standard accounts can submit one order every 10 minutes. Verified clients and admins are exempt.",
  },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-16 sm:px-8">
      {/* ── Header ── */}
      <div className="text-center">
        <span className="badge-theme px-3 py-1 text-xs font-semibold">
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--accent-primary)" }}
          />
          24/7 Active Desk
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Support & Help Center
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-neutral-400">
          The fastest way to reach us is our Discord support desk. Email queries are
          also processed promptly.
        </p>
      </div>

      {/* ── Contact Cards ── */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="glass glass-hover flex flex-col items-center p-8 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-theme-border shadow-md"
            style={{ backgroundColor: "var(--accent-primary)", color: "var(--btn-primary-text)" }}
          >
            <DiscordIcon className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-base font-bold text-white">Discord Support Desk</h2>
          <p className="mt-1.5 text-xs text-neutral-400">
            Open a ticket for instant order status, payment help, or replacements.
          </p>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-6 text-xs font-semibold"
          >
            <DiscordIcon className="h-4 w-4" />
            Join Support Server
          </a>
        </div>

        <div className="glass glass-hover flex flex-col items-center p-8 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-theme-border shadow-md"
            style={{ backgroundColor: "var(--accent-primary)", color: "var(--btn-primary-text)" }}
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </span>
          <h2 className="mt-4 text-base font-bold text-white">Direct Email</h2>
          <p className="mt-1.5 text-xs text-neutral-400">
            For business inquiries, partner proposals, and urgent escalations.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="btn-ghost mt-6 text-xs font-semibold"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      {/* ── FAQ Section ── */}
      <div className="glass mt-16 p-8">
        <h2 className="text-lg font-bold text-white">Frequently Asked Questions</h2>
        <div className="mt-6 space-y-6 divide-y divide-white/5">
          {FAQS.map((faq, i) => (
            <div key={i} className={i === 0 ? "" : "pt-6"}>
              <h3 className="text-sm font-semibold text-white">{faq.q}</h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
