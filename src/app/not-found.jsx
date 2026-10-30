import Link from "next/link";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[75vh] items-center justify-center px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]" />
        <div
          className="absolute left-1/2 top-1/2 h-64 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
          style={{ background: "var(--radial-glow-1)" }}
        />
      </div>

      <div className="glass w-full max-w-md p-10 text-center shadow-2xl">
        <p className="font-mono text-7xl font-extrabold tracking-tight text-white">
          404
        </p>
        <h1 className="mt-4 text-xl font-bold text-white">Page Not Found</h1>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          The requested page could not be located on the server. It may have been
          moved, deleted, or entered with an invalid URL.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary !text-xs">
            Return to Home
          </Link>
          <Link href="/products" className="btn-ghost !text-xs">
            Browse Products
          </Link>
        </div>
      </div>
    </section>
  );
}
