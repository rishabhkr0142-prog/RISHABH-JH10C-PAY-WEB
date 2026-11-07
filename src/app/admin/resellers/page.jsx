import Link from "next/link";
import { listResellers } from "@/lib/reseller-admin";
import AdminPagination from "@/components/AdminPagination";
import ResellersManager from "./ResellersManager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminResellersPage({ searchParams }) {
  const q = String(searchParams?.q || "").trim();
  const requested = Number(searchParams?.page);
  const page =
    Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;

  const result = await listResellers({ q, page, limit: PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Resellers</h2>
          <p className="mt-1 text-xs text-neutral-400">
            {result.total} lifetime member{result.total === 1 ? "" : "s"} with 50%
            OFF on License App products.
          </p>
        </div>

        <form action="/admin/resellers" className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search name, email, Discord ID..."
            className="input !w-64 !py-1.5 !text-xs"
          />
          <button type="submit" className="btn-primary !py-1.5 !text-xs font-semibold">
            Search
          </button>
          {q && (
            <Link href="/admin/resellers" className="btn-ghost !py-1.5 !text-xs">
              Clear
            </Link>
          )}
        </form>
      </div>

      <ResellersManager resellers={result.users} />

      <AdminPagination
        basePath="/admin/resellers"
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        label="resellers"
        params={{ q }}
      />
    </div>
  );
}
