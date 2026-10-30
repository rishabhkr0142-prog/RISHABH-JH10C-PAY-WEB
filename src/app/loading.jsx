import { HeroSkeleton, StatSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 pb-20 sm:px-8">
      <HeroSkeleton />
      <section className="mx-auto max-w-5xl pb-16">
        <StatSkeleton />
      </section>
    </div>
  );
}
