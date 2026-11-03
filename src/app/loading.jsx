import { HeroSkeleton, StatSkeleton } from "@/components/Skeleton";
import Logo from "@/components/Logo";

export default function Loading() {
  return (
    <div className="px-4 pb-20 pt-8 sm:px-8">
      <div className="mx-auto mb-6 flex justify-center animate-pulse">
        <Logo variant="icon" size={44} priority={true} className="!border-theme-border shadow-xl" />
      </div>
      <HeroSkeleton />
      <section className="mx-auto max-w-5xl pb-16">
        <StatSkeleton />
      </section>
    </div>
  );
}
