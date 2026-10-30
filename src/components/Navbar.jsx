"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { NavbarThemeToggle } from "./ThemeSwitcher";

export function DiscordIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.32 4.72a19.6 19.6 0 0 0-4.83-1.5.07.07 0 0 0-.08.04c-.21.37-.44.86-.6 1.24a18.3 18.3 0 0 0-5.5 0c-.17-.39-.4-.87-.62-1.24a.08.08 0 0 0-.08-.04c-1.7.29-3.33.8-4.83 1.5a.07.07 0 0 0-.03.03C.53 9.4-.32 13.94.1 18.43a.08.08 0 0 0 .03.05 19.7 19.7 0 0 0 5.93 3 .08.08 0 0 0 .09-.03c.46-.62.87-1.27 1.22-1.96a.08.08 0 0 0-.04-.1 12.9 12.9 0 0 1-1.85-.88.08.08 0 0 1 0-.13c.12-.09.25-.2.36-.29a.07.07 0 0 1 .08-.01c3.88 1.77 8.1 1.77 12 0a.07.07 0 0 1 .08.01c.11.1.24.2.37.29a.08.08 0 0 1-.04.13c-.59.34-1.2.63-1.85.88a.08.08 0 0 0-.04.1c.36.69.77 1.34 1.22 1.95a.08.08 0 0 0 .09.03 19.7 19.7 0 0 0 5.94-3 .08.08 0 0 0 .03-.05c.5-5.09-.84-9.6-3.56-13.68a.06.06 0 0 0-.03-.03ZM8.02 15.72c-1.18 0-2.15-1.08-2.15-2.4 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.4 0 1.33-.95 2.41-2.15 2.41Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.4 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.4 0 1.33-.94 2.41-2.15 2.41Z" />
    </svg>
  );
}

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-xs font-black tracking-tight text-white shadow-sm transition group-hover:scale-105">
        RJ
      </span>
      <span className="font-sans text-sm font-bold tracking-tight text-white transition group-hover:text-neutral-300">
        RISHABH JH10C <span className="font-mono text-xs font-normal text-gradient">PAY WEB</span>
      </span>
    </Link>
  );
}

/** Avatar + username dropdown menu */
function UserMenu({ session }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await signOut({ callbackUrl: "/" });
    router.refresh();
  };

  const name = session?.user?.name || "User";
  const avatar = session?.user?.image;
  const isAdmin = Boolean(session?.user?.isAdmin);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5 transition hover:border-theme-border-hover"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="relative h-6 w-6 overflow-hidden rounded-full border border-theme-border bg-black">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/80">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="hidden max-w-[110px] truncate text-xs font-medium text-white sm:inline">
          {name}
        </span>
        {isAdmin && (
          <span className="hidden rounded border border-theme-border bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white lg:inline">
            Admin
          </span>
        )}
        <svg
          className={`h-3 w-3 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden
        >
          <path d="M6 8.5 1.5 4h9L6 8.5Z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-xl border border-theme-border bg-theme-surface p-1.5 shadow-2xl backdrop-blur-xl"
            role="menu"
          >
            <div className="border-b border-theme-border/50 px-3 py-2">
              <p className="truncate text-xs font-semibold text-white">{name}</p>
              <p className="truncate text-[10px] text-neutral-400">
                {session?.user?.email || "Discord Account"}
              </p>
            </div>

            <div className="py-1">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
                role="menuitem"
              >
                <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
                </svg>
                Dashboard
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                  role="menuitem"
                >
                  <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                  Admin Panel
                </Link>
              )}
            </div>

            <div className="border-t border-theme-border/50 pt-1">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-neutral-400 transition hover:bg-white/10 hover:text-white"
                role="menuitem"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l2.47-2.47a.75.75 0 1 0-1.06-1.06l-3.75 3.75a.75.75 0 0 0 0 1.06l3.75 3.75a.75.75 0 1 0 1.06-1.06l-2.47-2.47h9.546A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
                </svg>
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    ...(status === "authenticated"
      ? [{ href: "/dashboard", label: "Dashboard" }]
      : []),
    { href: "/support", label: "Support" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-theme-border bg-theme-surface/90 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        {/* Left: Brand */}
        <Logo />

        {/* Center: Desktop Links */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white/10 text-white font-semibold"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Theme Switcher & Auth Controls */}
        <div className="hidden items-center gap-3 md:flex">
          <NavbarThemeToggle />

          {status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-white/5" />
          ) : status === "authenticated" ? (
            <UserMenu session={session} />
          ) : (
            <Link
              href="/login"
              className="btn-primary !px-3.5 !py-1.5 !text-xs font-semibold"
            >
              <DiscordIcon className="h-3.5 w-3.5" />
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center gap-2 md:hidden">
          <NavbarThemeToggle />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-neutral-300"
            aria-label="Toggle navigation menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-theme-border bg-theme-surface px-4 pb-6 pt-3 md:hidden"
          >
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-white/10 text-white font-semibold"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              <div className="mt-4 border-t border-theme-border/50 pt-4">
                {status === "authenticated" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 px-3 py-1">
                      <span className="relative h-8 w-8 overflow-hidden rounded-full border border-theme-border bg-black">
                        {session?.user?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={session.user.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                            {(session?.user?.name || "U")[0]}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {session?.user?.name}
                        </p>
                        <p className="truncate text-[10px] text-neutral-400">
                          {session?.user?.email || "Discord User"}
                        </p>
                      </div>
                    </div>

                    {session?.user?.isAdmin && (
                      <Link
                        href="/admin"
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/5"
                      >
                        Admin Panel
                      </Link>
                    )}

                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 hover:text-white"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="btn-primary w-full justify-center !py-2.5 !text-xs font-semibold"
                  >
                    <DiscordIcon className="h-4 w-4" />
                    Sign In with Discord
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
