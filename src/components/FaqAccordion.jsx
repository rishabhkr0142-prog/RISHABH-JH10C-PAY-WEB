"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "@/components/Reveal";

const FAQS = [
  {
    q: "How fast is delivery after placing an order?",
    a: "After UPI payment is verified, automated delivery usually completes within 2 to 10 minutes. Live status is on your dashboard; some orders may need manual review.",
  },
  {
    q: "Why do I need to sign in?",
    a: "Discord or Google sign-in verifies your identity, links orders to your account, and helps prevent fake or duplicate accounts. Linking Discord also enables DM delivery and support roles.",
  },
  {
    q: "What payment methods are supported?",
    a: "Website checkout currently accepts UPI only. Pay the exact amount to the store UPI ID shown at checkout, then submit the 12-digit UTR. We never ask for your UPI PIN, bank password, or card details.",
  },
  {
    q: "How does UTR verification work?",
    a: "After paying, submit the 12-digit UTR from your receipt. We match it to an incoming payment for the same amount and order window. If it is not found yet, wait 30 to 60 seconds and retry.",
  },
  {
    q: "How does the order cooldown work?",
    a: "Non-admin accounts normally wait 10 minutes between orders. Admins are exempt; the current cooldown may be adjusted in store settings.",
  },
  {
    q: "Can I become a reseller?",
    a: "Yes. The reseller program is a one-time ₹149 lifetime membership. It gives 50% off License App products only, including future License App products. Coupons do not stack, and there are no wholesale or volume tiers.",
  },
  {
    q: "What happens if a product has an issue?",
    a: "If a key or delivery is defective or not as described, contact support with your order reference. We will investigate and provide a replacement, or a refund where a replacement cannot be provided, under the Refund Policy.",
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
