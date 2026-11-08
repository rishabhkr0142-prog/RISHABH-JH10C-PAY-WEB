import Link from "next/link";
import { DiscordIcon } from "@/components/Navbar";
import { getAllSettings } from "@/lib/settings";
import Logo from "@/components/Logo";

const linkClass = "text-neutral-400 transition hover:text-white";

export default async function Footer() {
  const year = new Date().getFullYear();
  let settings = {};
  try {
    settings = await getAllSettings();
  } catch (err) {
    settings = {};
  }

  const siteName = settings.site_name || "RISHABH JH10C PAY WEB";
  const discordUrl = settings.discord_invite || process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "#";
  const supportEmail = settings.support_email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@jh10c.com";

  return (
    <footer className="border-t border-theme-border bg-theme-surface px-4 py-14 sm:px-8 transition-colors duration-200">
      <div className="mx-auto grid gap-10 md:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
        {/* Brand */}
        <div>
          <Logo variant="combo" size={32} subtext="PAY WEB" href="/" />
          <p className="mt-3.5 max-w-sm text-xs leading-relaxed text-neutral-400">
            Engineered for high-speed digital transactions. Verified Discord authentication,
            instant automated provisioning, and dedicated 24/7 client care.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--accent-primary)" }}
            />
            <span>Systems fully operational</span>
          </div>
        </div>

        {/* Explore */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Explore
          </h3>
          <ul className="mt-3.5 space-y-2 text-xs">
            <li>
              <Link href="/" className={linkClass}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/products" className={linkClass}>
                Browse all products
              </Link>
            </li>
            <li>
              <Link href="/offers" className={linkClass}>
                View current offers
              </Link>
            </li>
            <li>
              <Link href="/reseller" className={linkClass}>
                Reseller program (50% off)
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className={linkClass}>
                Client dashboard
              </Link>
            </li>
          </ul>
        </div>

        {/* Help & Legal */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Help &amp; Legal
          </h3>
          <ul className="mt-3.5 space-y-2 text-xs">
            <li>
              <Link href="/support" className={linkClass}>
                Support &amp; help center
              </Link>
            </li>
            <li>
              <Link href="/support#faq" className={linkClass}>
                Frequently asked questions
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkClass}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className={linkClass}>
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/refund" className={linkClass}>
                Refund Policy
              </Link>
            </li>
          </ul>
        </div>

        {/* Direct Contact */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Direct Contact
          </h3>
          <ul className="mt-3.5 space-y-2 text-xs">
            <li>
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-neutral-400 transition hover:text-white"
              >
                <DiscordIcon className="h-3.5 w-3.5" />
                Discord Community
              </a>
            </li>
            <li>
              <a
                href={`mailto:${supportEmail}`}
                className="text-neutral-400 transition hover:text-white truncate block"
              >
                {supportEmail}
              </a>
            </li>
            <li>
              <Link href="/support" className={linkClass}>
                Order &amp; payment help
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-theme-border/50 pt-6 sm:flex-row">
        <p className="text-[11px] text-neutral-500">
          © {year} {siteName}. All rights reserved.
        </p>
        <p className="font-mono text-[11px] text-neutral-500">
          UI/UX Pro Max Engine · Next.js 14 · MongoDB · Discord OAuth
        </p>
      </div>
    </footer>
  );
}
