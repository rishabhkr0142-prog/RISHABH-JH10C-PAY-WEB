"use client";

import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";

export default function StatsSection({ stats }) {
  const cards = [
    {
      key: "users",
      label: "Total Users",
      value: stats?.users ?? 0,
      description: "Registered community members",
    },
    {
      key: "clients",
      label: "Total Clients",
      value: stats?.clients ?? 0,
      description: "Verified customer accounts",
    },
    {
      key: "orders",
      label: "Total Orders",
      value: stats?.orders ?? 0,
      description: "Delivered transactions",
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card, i) => (
          <Reveal key={card.key} delay={0.08 * i}>
            <div className="glass glass-hover group p-6">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {card.label}
              </span>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                <CountUp value={card.value} />
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {card.description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
