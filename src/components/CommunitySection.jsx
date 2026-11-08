"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";

export default function CommunitySection({ communityData }) {
  const total = communityData?.total ?? 0;
  const avatars = communityData?.latestAvatars ?? [];
  const [hoveredUser, setHoveredUser] = useState(null);

  const displayedAvatars = avatars.slice(0, 12);
  const remainingCount = Math.max(0, total - displayedAvatars.length);

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-8 border-t border-theme-border">
      <Reveal>
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Backed by a thriving community
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Trusted by{" "}
            <span className="text-gradient">
              {total > 0 ? Number(total).toLocaleString("en-IN") : "active"}
            </span>{" "}
            members
          </h2>
          <p className="mt-2 max-w-md text-xs text-neutral-400 sm:text-sm">
            Join hundreds of satisfied clients and developers accessing our services daily.
          </p>

          {/* Overlapping Discord Avatars */}
          <div className="mt-8 flex items-center justify-center -space-x-2.5">
            {displayedAvatars.map((u, i) => (
              <div
                key={i}
                className="group relative"
                onMouseEnter={() => setHoveredUser(u)}
                onMouseLeave={() => setHoveredUser(null)}
              >
                <div
                  className="relative h-10 w-10 overflow-hidden rounded-full border-2 bg-black transition-transform duration-150 hover:z-20 hover:scale-125"
                  style={{ borderColor: "var(--bg-base)" }}
                >
                  {u.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar}
                      alt={`${u.username || "Community member"} Discord avatar`}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-neutral-300">
                      {(u.username || "U")[0].toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Hover Tooltip (Username & Avatar ONLY) */}
                {hoveredUser?.username === u.username && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-theme-border bg-theme-surface px-2.5 py-1 text-xs font-medium text-white shadow-xl">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: "var(--accent-primary)" }}
                      />
                      <span>{u.username}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* "+N more" badge */}
            {remainingCount > 0 && (
              <div
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-theme-raised text-[11px] font-bold text-white shadow-sm"
                style={{ borderColor: "var(--bg-base)" }}
              >
                +{remainingCount > 999 ? "1k" : remainingCount}
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
