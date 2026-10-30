"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "@/components/Reveal";

const FAQS = [
  {
    q: "How fast is delivery after placing an order?",
    a: "Orders are processed through automated fulfillment. Most digital licenses and credentials are confirmed within 2 to 10 minutes. Real-time updates appear immediately on your personal Dashboard.",
  },
  {
    q: "Why do I need to sign in with Discord?",
    a: "Discord OAuth ensures verified identities, eliminates fake bot accounts, and ties your orders directly to your Discord account for one-click access and support role synchronization.",
  },
  {
    q: "What payment methods are supported?",
    a: "We are currently accepting pending orders through our automated pipeline. Manual and automated gateway completions are facilitated through our official Discord server.",
  },
  {
    q: "What is the 10-minute order cooldown?",
    a: "To prevent spam and protect our automated delivery queues, standard accounts have a 10-minute cooldown period between placing consecutive orders. Admins and verified priority clients are exempt.",
  },
  {
    q: "What happens if a product has an issue?",
    a: "Every transaction comes with a complete replacement guarantee. If anything does not perform as described, open a ticket via Discord or click Contact Support on your Dashboard order receipt.",
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (i) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-8 border-t border-theme-border">
      <Reveal>
        <div className="section-heading">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Got questions?
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm text-neutral-400 sm:text-base">
            Everything you need to know about our store, orders, and fulfillment.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 space-y-3">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <Reveal key={faq.q} delay={0.06 * i}>
              <div className="overflow-hidden rounded-xl border border-theme-border bg-theme-surface transition hover:border-theme-border-hover">
                <button
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white"
                  aria-expanded={isOpen}
                >
                  <span>{faq.q}</span>
                  <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-theme-border bg-theme-surface text-neutral-400">
                    <svg
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <path d="M6 8.5 1.5 4h9L6 8.5Z" />
                    </svg>
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="border-t border-theme-border/50 px-5 pb-5 pt-2 text-xs leading-relaxed text-neutral-400 sm:text-sm">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
