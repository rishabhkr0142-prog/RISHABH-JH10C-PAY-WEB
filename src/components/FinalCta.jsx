"use client";

import Link from "next/link";
import { DiscordIcon } from "@/components/Navbar";
import Reveal from "@/components/Reveal";

export default function FinalCta({ discordUrl = "#" }) {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-8 border-t border-theme-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 top-1/2 h-64 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
          style={{ background: "var(--radial-glow-1)" }}
        />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <span className="badge-theme px-3 py-1 text-xs font-semibold">
            Automated Delivery · Verified Quality
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ready to get started?
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            Explore our catalog of digital services, or connect with our active Discord
            community to ask questions and get instant support.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link href="/products" className="btn-primary px-7 py-3 text-sm">
              Browse Products
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}
