/**
 * Loading skeleton building blocks (shimmer effect).
 * Used by the app-level loading.js / admin loading.js files.
 */

export function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-white/[0.05] ${className}`}
    >
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

/** Home hero skeleton */
export function HeroSkeleton() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center px-4 py-28 text-center">
      <SkeletonBlock className="h-8 w-64" />
      <SkeletonBlock className="mt-6 h-14 w-full max-w-3xl" />
      <SkeletonBlock className="mt-3 h-14 w-2/3 max-w-xl" />
      <div className="mt-10 flex gap-4">
        <SkeletonBlock className="h-12 w-44" />
        <SkeletonBlock className="h-12 w-44" />
      </div>
    </section>
  );
}

/** Live stats skeleton — one shimmering card per stat */
export function StatSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass p-8">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="mt-4 h-10 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Products grid skeleton */
export function ProductsSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass overflow-hidden">
          <SkeletonBlock className="h-44 w-full rounded-none" />
          <div className="p-6">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="mt-3 h-4 w-full" />
            <div className="mt-6 flex items-center justify-between">
              <SkeletonBlock className="h-6 w-20" />
              <SkeletonBlock className="h-10 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
