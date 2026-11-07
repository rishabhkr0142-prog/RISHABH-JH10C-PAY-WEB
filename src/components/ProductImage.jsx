"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cloudinaryImageUrl, isRenderableImageUrl } from "@/lib/image-url";

export default function ProductImage({
  src,
  alt,
  sizes = "100vw",
  width = 1200,
  priority = false,
  className = "",
  fallbackText,
}) {
  const usable = isRenderableImageUrl(src);
  const displaySrc = usable ? cloudinaryImageUrl(src, { width }) : "";
  const [failed, setFailed] = useState(!usable);

  useEffect(() => {
    setFailed(!isRenderableImageUrl(src));
  }, [src]);

  if (failed || !usable) {
    const initial =
      String(fallbackText || alt || "P")
        .trim()
        .slice(0, 2)
        .toUpperCase() || "P";

    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800"
        aria-label={alt || fallbackText || "Product image unavailable"}
      >
        <svg
          className="h-6 w-6 text-neutral-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M21 15l-5-5L5 20" />
        </svg>
        <span className="font-mono text-xl font-bold text-neutral-400">{initial}</span>
      </div>
    );
  }

  return (
    <Image
      src={displaySrc}
      alt={alt || ""}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
