"use client";

import Reveal from "@/components/Reveal";

const FEATURES = [
  {
    title: "Instant Delivery",
    desc: "Automated fulfillment delivers license credentials and product access within moments of confirmation.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "24/7 Live Support",
    desc: "Direct access to our dedicated Discord support desk with immediate response times for any question.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    title: "Discord Linked",
    desc: "Seamless single sign-on with Discord OAuth. No complicated passwords or duplicate account registrations.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    title: "Secure Payments",
    desc: "Rigorous anti-tamper order tracking, end-to-end encrypted transactions, and full audit logs.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: "Verified Products",
    desc: "Every product, bot, source code, and key is pre-tested and guaranteed before entering the catalog.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "99.9% Uptime",
    desc: "High availability infrastructure engineered to keep your orders accessible around the clock.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
];

export default function FeaturesGrid() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-8">
      <Reveal>
        <div className="section-heading">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Engineered for reliability
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mt-3 text-sm text-neutral-400 sm:text-base">
            Built with uncompromising attention to speed, safety, and simplicity.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((item, i) => (
          <Reveal key={item.title} delay={0.06 * i}>
            <div className="glass glass-hover group p-6">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-theme-border bg-theme-surface transition group-hover:scale-105"
                style={{ color: "var(--accent-primary)" }}
              >
                {item.icon}
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {item.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
