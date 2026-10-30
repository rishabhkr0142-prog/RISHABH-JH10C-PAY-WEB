"use client";

import Reveal from "@/components/Reveal";

const STEPS = [
  {
    step: "01",
    title: "Select your product",
    desc: "Browse our curated catalog on the Products page. Filter by categories, features, and availability.",
  },
  {
    step: "02",
    title: "One-click Discord auth",
    desc: "Sign in instantly with your Discord account. No passwords, no lengthy signup forms required.",
  },
  {
    step: "03",
    title: "Instant fulfillment",
    desc: "Place your order securely. Track progress on your dashboard and receive access details immediately.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-8 border-t border-theme-border">
      <Reveal>
        <div className="section-heading">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Simple workflow
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            How it works in 3 steps
          </h2>
          <p className="mt-3 text-sm text-neutral-400 sm:text-base">
            From discovering the right product to immediate delivery in under two minutes.
          </p>
        </div>
      </Reveal>

      <div className="relative mt-16 grid gap-8 md:grid-cols-3">
        {/* Connecting horizontal line on desktop */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-1/4 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent md:block"
        />

        {STEPS.map((s, i) => (
          <Reveal key={s.step} delay={0.1 * i}>
            <div className="glass glass-hover relative z-10 flex flex-col items-center p-8 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full border border-theme-border font-mono text-sm font-bold shadow-md"
                style={{ backgroundColor: "var(--bg-base)", color: "var(--accent-primary)" }}
              >
                {s.step}
              </span>
              <h3 className="mt-5 text-base font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {s.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
