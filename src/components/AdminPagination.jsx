import Link from "next/link";

function buildHref(basePath, params, page, pageParam) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else {
      query.set(key, String(value));
    }
  }
  if (page > 1) query.set(pageParam, String(page));
  else query.delete(pageParam);
  const suffix = query.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

/**
 * Simple server-rendered pagination bar for admin lists.
 * Keeps all existing query params and only changes "page".
 */
export default function AdminPagination({
  basePath,
  page = 1,
  totalPages = 1,
  total = 0,
  params = {},
  label = "items",
  pageParam = "page",
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  if (totalPages <= 1) {
    return (
      <p className="text-[11px] text-neutral-500">
        {total} {label}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <p className="text-[11px] text-neutral-500">
        {total} {label} · page {safePage} of {safeTotalPages}
      </p>
      <div className="flex items-center gap-2">
        {safePage > 1 ? (
          <Link
            href={buildHref(basePath, params, safePage - 1, pageParam)}
            className="rounded-lg border border-white/10 px-3 py-1.5 font-semibold text-neutral-300 transition hover:border-white/30 hover:text-white"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-lg border border-white/5 px-3 py-1.5 font-semibold text-neutral-600">
            Previous
          </span>
        )}
        {safePage < safeTotalPages ? (
          <Link
            href={buildHref(basePath, params, safePage + 1, pageParam)}
            className="rounded-lg border border-white/10 px-3 py-1.5 font-semibold text-neutral-300 transition hover:border-white/30 hover:text-white"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-lg border border-white/5 px-3 py-1.5 font-semibold text-neutral-600">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
