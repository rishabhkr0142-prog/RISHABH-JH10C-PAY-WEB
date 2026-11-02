"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import { formatCompactCount } from "@/lib/google-avatar";

function NeutralAvatar() {
  return (
    <span className="flex h-full w-full items-center justify-center bg-theme-raised">
      <svg
        className="h-4 w-4 text-neutral-500 sm:h-[18px] sm:w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function GoogleAvatar({ src }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 bg-theme-raised shadow-sm sm:h-10 sm:w-10"
      style={{ borderColor: "var(--bg-base)" }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <NeutralAvatar />
      )}
    </div>
  );
}

export default function GoogleUsersSection({ googleUsers }) {
  const total = Math.max(0, Number(googleUsers?.total) || 0);
  const avatars = Array.isArray(googleUsers?.avatars)
    ? googleUsers.avatars.filter(Boolean).slice(0, 4)
    : [];

  // Hide completely when there are no Google sign-ins.
  if (total <= 0) return null;

  // Spec: "+N" = total minus the first four. No badge below four users, even
  // when fewer photos are visible because some members opted out.
  const remainingCount = total > 4 ? total - 4 : 0;

  return (
    <section className="mx-auto max-w-5xl border-t border-theme-border px-4 py-16 sm:px-8">
      <Reveal>
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Joined with Google
          </p>

          <div className="mt-5 flex items-center justify-center -space-x-2.5 sm:-space-x-3">
            {avatars.map((avatar, index) => (
              <GoogleAvatar key={`${avatar}-${index}`} src={avatar} />
            ))}

            {remainingCount > 0 && (
              <div
                className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-theme-raised px-1 text-[10px] font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:text-[11px]"
                style={{ borderColor: "var(--bg-base)" }}
                title={`${remainingCount.toLocaleString("en-IN")} more Google users`}
              >
                +{formatCompactCount(remainingCount)}
              </div>
            )}
          </div>

          <p className="mt-3 text-[11px] text-neutral-500 sm:text-xs">
            {total.toLocaleString("en-IN")}{" "}
            {total === 1 ? "account" : "accounts"} signed in with Google
          </p>
        </div>
      </Reveal>
    </section>
  );
}
