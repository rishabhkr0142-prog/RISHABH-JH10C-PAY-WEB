"use client";

import Reveal from "@/components/Reveal";

const REASONS = [
  {
    title: "Instant Fulfillment",
    desc: "Every order is processed and delivered within minutes of purchase — no waiting around, ever.",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path d="M13 2 3 11h5v7l10-9h-5l0-7Z" />
      </svg>
    ),
  },
  {
    title: "100% Verified Quality",
    desc: "Safe, verified digital products with transparent pricing. What you see is exactly what you get.",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path d="M10 1 3.5 3.5V9c0 4.4 2.8 7.7 6.5 10 3.7-2.3 6.5-5.6 6.5-10V3.5L10 1Zm-1 12-3-3 1.4-1.4L9 10.2l3.6-3.6L14 8l-5 5Z" />
      </svg>
    ),
  },
  {
    title: "24/7 Discord Desk",
    desc: "Questions or issues? Our team is online around the clock in Discord, ready to assist immediately.",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path d="M10 2a8 8 0 0 0-8 8v3.5A2.5 2.5 0 0 0 4.5 16H6v-6H4A6 6 0 0 1 16 10h-2v6h1.5c.5 0 1-.15 1.5-.4V16a3 3 0 0 1-3 3H9v2h5v-2h.5a3.5 3.5 0 0 0 3.5-3.5V10a8 8 0 0 0-8-8Z" />
      </svg>
    ),
  },
];

export default function WhyChooseUs() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-8 border-t border-white/10 pt-16">
      <Reveal>
        <div className="section-heading">
          <h2>
            Why <span className="text-gradient">Choose Us</span>
          </h2>
          <p>Everything you need for seamless digital purchases.</p>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {REASONS.map((reason, i) => (
          <Reveal key={reason.title} delay={0.08 * i}>
            <div className="group rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-center transition-all duration-200 hover:border-white/25 hover:bg-[#111111]">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition group-hover:border-white/20 group-hover:bg-white/10">
                {reason.icon}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">
                {reason.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {reason.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
