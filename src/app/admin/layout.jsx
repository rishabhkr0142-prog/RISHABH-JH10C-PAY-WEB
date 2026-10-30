import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isUserAdmin } from "@/lib/auth";
import AdminTabs from "./AdminTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin Panel" };

export default async function AdminLayout({ children }) {
  const session = await getSession();

  if (!session || !isUserAdmin(session)) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-theme-border pb-6">
        <div>
          <span className="badge-theme px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--accent-primary)" }}
            />
            Verified Admin Access
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Admin Management Console
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Store operations, inventory catalog, order pipeline, and configuration.
          </p>
        </div>

        <div className="glass flex items-center gap-3 px-3.5 py-2">
          {session.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-7 w-7 rounded-full border border-theme-border object-cover"
            />
          ) : null}
          <div className="text-left">
            <p className="text-xs font-bold text-white">{session.user?.name}</p>
            <p className="font-mono text-[10px] text-neutral-400">Owner / SuperAdmin</p>
          </div>
        </div>
      </div>

      <AdminTabs />

      <div className="mt-8">{children}</div>
    </div>
  );
}
