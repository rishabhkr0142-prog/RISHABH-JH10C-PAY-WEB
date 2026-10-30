"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/stats", label: "Live Stats" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-1.5 overflow-x-auto border-b border-theme-border pb-3">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition ${
              active
                ? "btn-primary !px-4 !py-2 !text-xs font-bold shadow-sm"
                : "text-neutral-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
