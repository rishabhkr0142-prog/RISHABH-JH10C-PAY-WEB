export default function OffersLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      {/* Header skeleton */}
      <div className="mb-10 space-y-3">
        <div className="h-6 w-32 animate-pulse rounded-full bg-white/5" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/5" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]"
          >
            {/* Image placeholder */}
            <div className="aspect-[16/9] w-full animate-pulse bg-white/5" />

            {/* Content placeholder */}
            <div className="flex flex-1 flex-col p-5 space-y-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-white/5" />
              </div>

              {/* Coupon code placeholder */}
              <div className="h-8 w-full animate-pulse rounded-lg bg-white/5" />

              {/* Countdown box placeholder */}
              <div className="h-14 w-full animate-pulse rounded-lg bg-white/5" />

              {/* Footer placeholder */}
              <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
                <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
                <div className="h-7 w-24 animate-pulse rounded-lg bg-white/10" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

