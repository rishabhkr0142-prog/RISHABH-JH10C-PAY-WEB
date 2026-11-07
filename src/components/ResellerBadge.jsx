export default function ResellerBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white ${className}`}
    >
      <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.77l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L10 1.5z" />
      </svg>
      Reseller
    </span>
  );
}
