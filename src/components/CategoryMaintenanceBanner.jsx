import Link from "next/link";

export default function CategoryMaintenanceBanner({ categories = [] }) {
  if (!categories || categories.length === 0) {
    return null;
  }

  const count = categories.length;

  return (
    <section aria-label="Store Maintenance Notice" className="relative z-10 mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-neutral-900/60 to-amber-950/30 p-4 sm:p-5 shadow-[0_4px_24px_rgba(245,158,11,0.08)] backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Scheduled Maintenance
                </span>
                <span className="text-xs font-semibold text-white">
                  {count === 1
                    ? `Category "${categories[0].name}" is currently under maintenance`
                    : `${count} categories are currently under maintenance`}
                </span>
              </div>

              {count === 1 ? (
                <p className="mt-1 text-xs text-neutral-300">
                  {categories[0].maintenanceReason ||
                    "We are performing updates. Existing orders remain safe and active."}
                  {categories[0].maintenanceUntil && (
                    <span className="ml-2 font-mono text-[11px] text-amber-300">
                      (Estimated completion: {categories[0].maintenanceUntil})
                    </span>
                  )}
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-neutral-300">
                  <span>Affected categories:</span>
                  {categories.map((c, i) => (
                    <span
                      key={c._id || c.name || i}
                      className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-white"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 pl-12 sm:pl-0">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
            >
              <span>Browse Active Catalog</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

