"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { DiscordIcon } from "@/components/Navbar";

export default function Hero({ discordUrl = "#" }) {
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-12 text-center sm:px-8 sm:pt-28">
      {/* Dynamic ambient glow & pattern */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,black,transparent)]" />
        <div
          className="absolute left-1/2 top-10 h-80 w-[32rem] -translate-x-1/2 rounded-full blur-[110px] transition-colors duration-300"
          style={{ background: "var(--radial-glow-1)" }}
        />
        <div
          className="absolute right-[15%] top-28 h-64 w-64 rounded-full blur-[120px] transition-colors duration-300"
          style={{ background: "var(--radial-glow-2)" }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl">
        {/* Eyebrow badge */}
        <motion.div {...fadeUp(0)}>
          <span className="badge-theme px-3.5 py-1 text-xs font-semibold backdrop-blur shadow-sm">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--accent-primary)" }}
            />
            RISHABH JH10C PAY WEB · Instant Automated Fulfillment
          </span>
        </motion.div>

        {/* Huge headline */}
        <motion.h1
          {...fadeUp(0.1)}
          className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          Engineered for Speed.{" "}
          <span className="text-gradient">Delivered Instantly.</span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          {...fadeUp(0.2)}
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg"
        >
          The next-generation digital store for premium subscriptions, developer tools,
          and gaming assets. Seamless Discord integration and 24/7 dedicated support.
        </motion.p>

        {/* Buttons */}
        <motion.div
          {...fadeUp(0.3)}
          className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
        >
          <Link href="/products" className="btn-primary px-7 py-3 text-sm">
            Get Started
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>

          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost px-7 py-3 text-sm"
          >
            <DiscordIcon className="h-4 w-4" />
            Join Discord
          </a>
        </motion.div>
      </div>
    </section>
  );
}
