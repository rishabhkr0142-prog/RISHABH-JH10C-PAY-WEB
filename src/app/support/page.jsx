"use client";

import { DiscordIcon } from "@/components/Navbar";
import WhatsAppSupport from "@/components/WhatsAppSupport";

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
          The fastest way to reach us is WhatsApp or our Discord support desk.
          Email queries are also processed promptly.
        </p>
      </div>

      {/* ── Contact Cards ── */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass glass-hover flex flex-col items-center p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-theme-border bg-[#25D366] text-[#062d16] shadow-md">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.21-8.23 8.21Z" />
            </svg>
          </span>
          <h2 className="mt-4 text-base font-bold text-white">WhatsApp Support</h2>
          <p className="mt-1.5 text-xs text-neutral-400">
            Fastest replies for order status, payment help, and replacements.
          </p>
          <WhatsAppSupport
            message="Hello, mujhe support chahiye."
            label="Chat on WhatsApp"
            className="mt-6"
          />
        </div>

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
